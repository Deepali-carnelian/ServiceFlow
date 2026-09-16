const { geminiConfigured } = require('../config/env');
const { callGeminiAuto, parseModelJson } = require('../ai/geminiClient');
const { localDraft, localExtract } = require('../ai/localFallback');
const { readJson } = require('../http/body');
const { sendJson } = require('../http/response');

const EXTRACTION_PROMPT = `
You convert messy customer calls, texts, website messages and emails
into structured service requests for a small commercial refrigeration
repair company.

Return ONLY one valid JSON object. Do not use markdown.

Required JSON shape:
{
  "customer": "string",
  "company": "string",
  "phone": "string",
  "source": "string",
  "equipment": "string",
  "issue": "string",
  "priority": "Normal or Urgent",
  "summary": "string",
  "suggestedStatus": "New or Quote Needed",
  "suggestedFollowupDays": 0
}

Rules:
- Never invent a customer name, company or phone number.
- If a detail is missing, use an empty string.
- Keep source equal to the supplied intake channel.
- Urgent means equipment is down, stock/food is at risk, or the customer requests emergency/same-day help.
- Use "Quote Needed" only if the customer explicitly asks for a quote, estimate, cost or pricing.
- Otherwise use "New".
- suggestedFollowupDays should be 0 for urgent requests and normally 1 for non-urgent requests.
- Keep issue and summary concise.
`.trim();

const DRAFT_PROMPT = `
You write short customer follow-up SMS messages for Denise, owner of a small commercial refrigeration repair company.

Return ONLY the SMS text.

Rules:
- Natural, professional and concise.
- Maximum 320 characters.
- Use the customer's first name when known.
- Briefly reference the equipment or issue.
- Respect the current job status.
- Never invent a price, appointment time, technician, diagnosis, completion status or guarantee.
- Do not promise same-day service unless the job data explicitly says it.
- End with one clear next action or question.
`.trim();

async function handleExtract(req, res) {
  try {
    const body = await readJson(req);
    const text = String(body.text || '').trim();
    const source = String(body.source || 'Unknown').trim();

    if (!text) return sendJson(res, 400, { error: 'Request text is required.' });

    const fallback = () => sendJson(res, 200, {
      mode: 'demo-fallback',
      provider: 'Local fallback',
      model: 'local-demo-parser',
      result: localExtract(text, source)
    });

    if (!geminiConfigured()) return fallback();

    try {
      const llm = await callGeminiAuto({
        systemInstruction: EXTRACTION_PROMPT,
        userText: `Intake channel: ${source}\n\nCustomer message:\n${text}`,
        jsonOutput: true,
        temperature: 0.1
      });
      const result = parseModelJson(llm.text);
      result.source = source;

      return sendJson(res, 200, {
        mode: 'live-llm',
        provider: 'Gemini',
        model: llm.model,
        result
      });
    } catch (error) {
      console.warn('[Gemini] Intake fell back to local mode:', error.message);
      return fallback();
    }
  } catch (error) {
    console.error('Extract request error:', error);
    return sendJson(res, 500, { error: error.message || 'Unable to analyse the request.' });
  }
}

async function handleDraft(req, res) {
  try {
    const body = await readJson(req);
    const job = body.job || body;
    if (!job || typeof job !== 'object') return sendJson(res, 400, { error: 'Job details are required.' });

    const fallback = () => sendJson(res, 200, {
      mode: 'demo-fallback',
      provider: 'Local fallback',
      model: 'local-demo-writer',
      draft: localDraft(job)
    });

    if (!geminiConfigured()) return fallback();

    const safeJob = {
      customer: job.customer || '',
      company: job.company || '',
      equipment: job.equipment || '',
      issue: job.issue || '',
      status: job.status || '',
      priority: job.priority || '',
      notes: job.notes || ''
    };

    try {
      const llm = await callGeminiAuto({
        systemInstruction: DRAFT_PROMPT,
        userText: JSON.stringify(safeJob, null, 2),
        temperature: 0.4
      });

      return sendJson(res, 200, {
        mode: 'live-llm',
        provider: 'Gemini',
        model: llm.model,
        draft: llm.text.trim()
      });
    } catch (error) {
      console.warn('[Gemini] Draft fell back to local mode:', error.message);
      return fallback();
    }
  } catch (error) {
    console.error('Draft request error:', error);
    return sendJson(res, 500, { error: error.message || 'Unable to draft the follow-up.' });
  }
}

module.exports = { handleExtract, handleDraft };
