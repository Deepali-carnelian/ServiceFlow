const crypto = require('crypto');
const { geminiConfigured, AUTO_CREATE_LEADS } = require('../config/env');
const { callGeminiAuto, parseModelJson } = require('../ai/geminiClient');
const { localExtract } = require('../ai/localFallback');
const { addInbound, hasExternalId, getInboundByExternalId, logEvent, listCrmJobs, upsertCrmJob } = require('./store');

const AUTOMATION_PROMPT = `
You extract inbound service requests for a small commercial refrigeration repair company.
Return ONLY one valid JSON object. No markdown.
Exact shape:
{"customer":"string","company":"string","phone":"string","email":"string","equipment":"string","issue":"string","priority":"Normal or Urgent","summary":"string","suggestedStatus":"New or Waiting on Quote","suggestedFollowupDays":0,"nextAction":"string","confidence":0.0}
Rules:
- Never invent names, company names, phone numbers, email addresses, prices, diagnoses or appointment times.
- Missing identity/contact fields must be empty strings.
- Urgent only when equipment is down, food/product is at risk, or same-day/emergency help is requested.
- Waiting on Quote only when the customer explicitly asks for a quote, estimate, price or cost. Otherwise New.
- suggestedFollowupDays is 0 for urgent requests and normally 1 otherwise.
- nextAction must be a short operational action grounded in the request, such as "Call customer today", "Prepare estimate", or "Confirm equipment details".
- confidence is 0 to 1 and reflects confidence that this is a genuine service request and the extracted facts are supported.
- Keep issue and summary concise.
`.trim();

function stableId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}
function sanitizeText(value, max = 20_000) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, max);
}
function normalizePhone(value = '') { return String(value).replace(/\D/g, '').slice(-10); }
function customerKey({ email = '', phone = '', company = '', customer = '' } = {}) {
  const normalizedEmail = sanitizeText(email, 254).toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  if (normalizedEmail) return `email:${normalizedEmail}`;
  if (normalizedPhone.length >= 7) return `phone:${normalizedPhone}`;
  const fallback = `${sanitizeText(company, 120)}|${sanitizeText(customer, 100)}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return fallback ? `name:${stableId(fallback)}` : '';
}

function normalizeResult(result, inbound) {
  const source = inbound.source || 'Unknown';
  const email = sanitizeText(result?.email || inbound.senderEmail || '', 254);
  const customer = sanitizeText(result?.customer || inbound.from || '', 100);
  const company = sanitizeText(result?.company || '', 120);
  const phone = sanitizeText(result?.phone || inbound.phone || '', 50);
  const equipment = sanitizeText(result?.equipment || 'Commercial refrigeration equipment', 140);
  const issue = sanitizeText(result?.issue || inbound.body || inbound.subject || '', 500);
  const summary = sanitizeText(result?.summary || issue, 350);
  const priority = result?.priority === 'Urgent' ? 'Urgent' : 'Normal';
  const suggestedStatus = ['Waiting on Quote', 'Quote Needed'].includes(result?.suggestedStatus) ? 'Waiting on Quote' : 'New';
  const suggestedFollowupDays = Number.isFinite(Number(result?.suggestedFollowupDays))
    ? Math.max(0, Math.min(14, Number(result.suggestedFollowupDays)))
    : priority === 'Urgent' ? 0 : 1;
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence ?? 0.72)));
  const nextAction = sanitizeText(result?.nextAction || (priority === 'Urgent' ? 'Call customer today' : suggestedStatus === 'Waiting on Quote' ? 'Prepare estimate' : 'Review and contact customer'), 160);

  return {
    customer, company, phone, email, source, equipment, issue, priority, summary,
    suggestedStatus, suggestedFollowupDays, nextAction, confidence,
    customerKey: customerKey({ email, phone, company, customer })
  };
}

async function analyseInbound(inbound) {
  const combined = [
    inbound.subject ? `Subject: ${inbound.subject}` : '',
    inbound.from ? `From: ${inbound.from}` : '',
    inbound.senderEmail ? `Sender email: ${inbound.senderEmail}` : '',
    inbound.phone ? `Sender phone: ${inbound.phone}` : '',
    '', inbound.body || ''
  ].filter(Boolean).join('\n');

  if (geminiConfigured()) {
    try {
      const llm = await callGeminiAuto({
        systemInstruction: AUTOMATION_PROMPT,
        userText: `Intake channel: ${inbound.source || 'Unknown'}\n\n${combined}`,
        jsonOutput: true,
        temperature: 0.1
      });
      return { result: normalizeResult(parseModelJson(llm.text), inbound), provider: 'Gemini', model: llm.model };
    } catch (error) {
      console.warn('[Automation] Gemini extraction failed; using deterministic fallback:', error.message);
      logEvent({ source: 'AI', level: 'warn', type: 'fallback', message: `Gemini extraction failed; deterministic fallback used: ${error.message}` });
    }
  }

  const local = localExtract(combined, inbound.source || 'Unknown');
  local.email = inbound.senderEmail || '';
  const serviceSignal = /\b(freezer|cooler|refrigerat(?:or|ion|ed|ing)?|fridge|ice machine|display case|prep cooler|compressor|temperature|not cooling|leak|repair|service request|quote|estimate)\b/i.test(combined);
  local.confidence = serviceSignal ? 0.7 : 0.35;
  local.nextAction = /\b(quote|estimate|price|cost)\b/i.test(combined) ? 'Prepare estimate' : local.priority === 'Urgent' ? 'Call customer today' : 'Review and contact customer';
  return { result: normalizeResult(local, inbound), provider: 'Local fallback', model: 'local-demo-parser' };
}

function addDaysIso(days, base = new Date()) {
  const date = new Date(base);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}
function sameCustomer(job, analysis) {
  const email = String(analysis.email || '').trim().toLowerCase();
  const phone = normalizePhone(analysis.phone || '');
  return Boolean(
    (analysis.customerKey && job.customerKey && analysis.customerKey === job.customerKey) ||
    (email && String(job.email || '').trim().toLowerCase() === email) ||
    (phone.length >= 7 && normalizePhone(job.phone || '') === phone)
  );
}
function buildAutomatedCrmJob(inbound, analysis) {
  const existingJobs = listCrmJobs();
  const matched = existingJobs.find(job => sameCustomer(job, analysis)) || null;
  const received = new Date(inbound.receivedAt || Date.now());
  const safeReceived = Number.isNaN(received.getTime()) ? new Date() : received;
  const createdAt = safeReceived.toISOString().slice(0, 10);
  const job = {
    id: `crm-${stableId(inbound.externalId || inbound.id)}`,
    externalId: inbound.externalId || '',
    customerKey: analysis.customerKey || '',
    matchedCustomerId: matched?.id || '',
    customer: analysis.customer || matched?.customer || inbound.from || analysis.email || 'New customer',
    company: analysis.company || matched?.company || '',
    phone: analysis.phone || matched?.phone || inbound.phone || '',
    email: analysis.email || matched?.email || inbound.senderEmail || '',
    source: inbound.source || analysis.source || 'Unknown',
    equipment: analysis.equipment || 'Commercial refrigeration equipment',
    issue: analysis.issue || inbound.subject || 'Service request',
    status: analysis.suggestedStatus || 'New',
    value: 0,
    priority: analysis.priority || 'Normal',
    createdAt,
    lastContact: createdAt,
    nextFollowup: addDaysIso(analysis.suggestedFollowupDays || 0, safeReceived),
    nextAction: analysis.nextAction || (analysis.priority === 'Urgent' ? 'Call customer today' : 'Review and contact customer'),
    notes: analysis.summary || '',
    activities: [{
      id: `act-${stableId(`${inbound.externalId}:captured`)}`,
      type: 'automation',
      title: `${inbound.source} request auto-captured`,
      detail: `${inbound.subject}. AI confidence: ${Math.round(Number(analysis.confidence || 0) * 100)}%.`,
      at: new Date().toISOString()
    }],
    serverManaged: true
  };
  if (matched) job.activities.unshift({
    id: `act-${stableId(`${inbound.externalId}:matched`)}`,
    type: 'automation',
    title: 'Existing customer matched automatically',
    detail: `Matched ${matched.company || matched.customer} by email/phone identity.`,
    at: new Date().toISOString()
  });
  return upsertCrmJob(job);
}

async function processInbound(rawInbound) {
  const externalId = sanitizeText(rawInbound.externalId || '', 200);
  if (externalId && hasExternalId(externalId)) return getInboundByExternalId(externalId);

  const inbound = {
    id: rawInbound.id || `auto-${stableId(`${externalId}:${Date.now()}:${rawInbound.body || ''}`)}`,
    externalId,
    source: sanitizeText(rawInbound.source || 'Unknown', 30),
    from: sanitizeText(rawInbound.from || '', 120),
    senderEmail: sanitizeText(rawInbound.senderEmail || '', 254),
    phone: sanitizeText(rawInbound.phone || '', 50),
    subject: sanitizeText(rawInbound.subject || 'New service request', 200),
    body: sanitizeText(rawInbound.body || '', 20_000),
    receivedAt: rawInbound.receivedAt || new Date().toISOString(),
    metadata: rawInbound.metadata && typeof rawInbound.metadata === 'object' ? rawInbound.metadata : {}
  };

  const analysed = await analyseInbound(inbound);
  const analysis = analysed.result;
  const identityPresent = Boolean(analysis.customer || analysis.company || analysis.phone || analysis.email);
  const serviceSignal = /\b(freezer|cooler|refrigerat(?:or|ion|ed|ing)?|fridge|ice machine|display case|prep cooler|compressor|temperature|not cooling|leak|repair|service request|quote|estimate)\b/i.test(`${inbound.subject} ${inbound.body}`);
  // If a message has a service signal and a usable identity, never hide it from Denise.
  // Lower-confidence extraction is still captured as a New job with a review action
  // instead of disappearing into a separate queue she has to manage.
  const captureReady = Boolean(identityPresent && analysis.issue && serviceSignal);
  const reviewNeeded = captureReady && analysis.confidence < 0.6;

  const finalItem = {
    ...inbound,
    analysis,
    automationReady: captureReady,
    processingStatus: captureReady ? (reviewNeeded ? 'captured-needs-review' : 'ready') : 'ignored-non-service',
    aiProvider: analysed.provider,
    aiModel: analysed.model,
    processedAt: new Date().toISOString()
  };
  if (captureReady && AUTO_CREATE_LEADS) {
    const jobAnalysis = reviewNeeded
      ? { ...analysis, suggestedStatus: 'New', nextAction: 'Review request details' }
      : analysis;
    const crmJob = buildAutomatedCrmJob(inbound, jobAnalysis);
    finalItem.crmJobId = crmJob.id;
  }
  const item = addInbound(finalItem);

  logEvent({
    source: inbound.source,
    level: captureReady ? 'info' : 'warn',
    type: captureReady ? (reviewNeeded ? 'lead-captured-review' : 'lead-ready') : 'ignored-non-service',
    message: captureReady
      ? `${analysis.company || analysis.customer || 'Inbound request'} captured into the job list${reviewNeeded ? ' with a review action' : ''}.`
      : `Inbound message did not look like a refrigeration service request and was not added to the job list.`,
    itemId: item.id,
    details: { provider: analysed.provider, confidence: analysis.confidence, customerKey: analysis.customerKey }
  });
  return item;
}

module.exports = { processInbound, analyseInbound, stableId, customerKey, buildAutomatedCrmJob };
