const { readJson } = require('../http/body');
const { sendJson } = require('../http/response');
const { geminiConfigured } = require('../config/env');
const { callGeminiAuto, parseModelJson } = require('../ai/geminiClient');

const ALLOWED_STATUSES = ['New','Waiting on Quote','Waiting on Yes','Needs Scheduling','Scheduled'];

const CALL_PROMPT = `
You summarize a customer service phone transcript for a small commercial refrigeration repair company.
Return ONLY one valid JSON object. No markdown.
Exact shape:
{"summary":"string","issueUpdate":"string","priority":"Normal or Urgent","suggestedStatus":"New, Waiting on Quote, Waiting on Yes, Needs Scheduling, or Scheduled","nextAction":"string","followupDays":0,"confidence":0.0}
Rules:
- Use only facts explicitly supported by the transcript and current job context.
- Never invent prices, technical diagnoses, parts, appointment times, customer identity, or promises.
- Urgent only when equipment is down, product/food is at risk, or same-day/emergency help is requested.
- If the customer explicitly asks for an estimate/quote and has not approved one, suggestedStatus may be Waiting on Quote.
- If a quote is already sent and the customer has not approved, suggestedStatus may be Waiting on Yes.
- If the customer clearly approves a quote or says to proceed, suggestedStatus may be Needs Scheduling.
- Use Scheduled only if the transcript clearly confirms a specific agreed appointment; otherwise use Needs Scheduling.
- Keep issueUpdate empty unless the transcript adds or clarifies the actual service problem.
- nextAction must be a short operational action grounded in the transcript.
- followupDays is 0 when action is needed today; normally 1 otherwise.
- confidence is 0 to 1.
`.trim();

function clean(value, max = 500) { return String(value || '').replace(/\0/g, '').trim().slice(0, max); }
function localCallSummary(transcript, currentJob = {}) {
  const text = clean(transcript, 20_000);
  const lower = text.toLowerCase();
  const currentStatus = ALLOWED_STATUSES.includes(currentJob.status) ? currentJob.status : 'New';
  const urgent = /\b(urgent|emergency|today|same day|product|food|stock)\b/.test(lower) && /\b(down|warm|warming|thaw|not cooling|stopped)\b/.test(lower);
  const approved = /\b(approved|go ahead|proceed|quote is approved|looks good)\b/.test(lower);
  const asksQuote = /\b(quote|estimate|price|pricing|cost)\b/.test(lower);
  const exactAppointment = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b.{0,40}\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon)\b/.test(lower) && /\b(confirm|confirmed|works|appointment|schedule)\b/.test(lower);

  let suggestedStatus = currentStatus;
  if (approved) suggestedStatus = 'Needs Scheduling';
  else if (asksQuote && ['New','Waiting on Quote'].includes(currentStatus)) suggestedStatus = 'Waiting on Quote';
  else if (currentStatus === 'Waiting on Yes') suggestedStatus = 'Waiting on Yes';
  if (exactAppointment && currentStatus === 'Needs Scheduling') suggestedStatus = 'Needs Scheduling'; // exact time still requires Denise to explicitly schedule in the UI.

  let nextAction = 'Follow up tomorrow';
  if (suggestedStatus === 'Waiting on Quote') nextAction = 'Prepare / send quote';
  else if (suggestedStatus === 'Waiting on Yes') nextAction = 'Follow up on quote';
  else if (suggestedStatus === 'Needs Scheduling') nextAction = 'Choose service date';
  else if (suggestedStatus === 'Scheduled') nextAction = 'Complete service visit';
  else if (urgent) nextAction = 'Review request and act today';
  else nextAction = 'Review job';

  const customerLines = text.split(/\r?\n/).filter(line => !/^denise\s*:/i.test(line)).map(line => line.replace(/^[^:]{1,80}:\s*/, '')).filter(Boolean);
  const summary = clean(customerLines.slice(-2).join(' '), 240) || 'Customer call completed and recorded.';
  return {
    summary,
    issueUpdate: '',
    priority: urgent ? 'Urgent' : (currentJob.priority === 'Urgent' ? 'Urgent' : 'Normal'),
    suggestedStatus,
    nextAction,
    followupDays: urgent || ['Waiting on Quote','Needs Scheduling'].includes(suggestedStatus) ? 0 : 1,
    confidence: 0.72
  };
}
function normalize(raw, currentJob = {}) {
  const fallback = localCallSummary('', currentJob);
  return {
    summary: clean(raw?.summary || fallback.summary, 300),
    issueUpdate: clean(raw?.issueUpdate || '', 400),
    priority: raw?.priority === 'Urgent' ? 'Urgent' : 'Normal',
    suggestedStatus: ALLOWED_STATUSES.includes(raw?.suggestedStatus) ? raw.suggestedStatus : (ALLOWED_STATUSES.includes(currentJob.status) ? currentJob.status : 'New'),
    nextAction: clean(raw?.nextAction || fallback.nextAction, 160),
    followupDays: Number.isFinite(Number(raw?.followupDays)) ? Math.max(0, Math.min(14, Number(raw.followupDays))) : 1,
    confidence: Number.isFinite(Number(raw?.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0.7
  };
}

async function handleAiRoutes(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/ai/call-summary') {
    try {
      const body = await readJson(req);
      const transcript = clean(body.transcript, 20_000);
      const currentJob = body.currentJob && typeof body.currentJob === 'object' ? body.currentJob : {};
      if (!transcript) return sendJson(res, 400, { error: 'Transcript is required.' });

      if (geminiConfigured()) {
        try {
          const result = await callGeminiAuto({
            systemInstruction: CALL_PROMPT,
            userText: `CURRENT JOB:\n${JSON.stringify(currentJob)}\n\nCALL TRANSCRIPT:\n${transcript}`,
            jsonOutput: true,
            temperature: 0.1
          });
          return sendJson(res, 200, { analysis: normalize(parseModelJson(result.text), currentJob), mode: 'gemini', model: result.model });
        } catch (error) {
          console.warn('[Call summary] Gemini failed, using deterministic fallback:', error.message);
        }
      }
      return sendJson(res, 200, { analysis: normalize(localCallSummary(transcript, currentJob), currentJob), mode: 'fallback' });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Unable to summarize call.' });
    }
  }
  return false;
}

module.exports = { handleAiRoutes, localCallSummary };
