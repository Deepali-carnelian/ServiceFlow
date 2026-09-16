const { ENV_MODEL, geminiConfigured } = require('./config/env');
const {
  getCandidateModels,
  getLastWorkingModel,
  isAutoModelSetting
} = require('./ai/modelRegistry');
const { sendJson } = require('./http/response');
const { serveStatic } = require('./http/staticFiles');
const { handleDraft, handleExtract } = require('./routes/aiRoutes');

async function router(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    let compatibleModels = null;
    if (geminiConfigured()) {
      try {
        compatibleModels = (await getCandidateModels(false)).length;
      } catch {}
    }

    return sendJson(res, 200, {
      ok: true,
      provider: 'Gemini',
      llmConfigured: geminiConfigured(),
      model: getLastWorkingModel() || (geminiConfigured() ? 'Auto-select' : 'demo fallback'),
      selectionMode: 'automatic',
      compatibleModels
    });
  }

  if (req.method === 'GET' && pathname === '/api/models') {
    if (!geminiConfigured()) return sendJson(res, 200, { configured: false, models: [] });

    try {
      const models = await getCandidateModels(true);
      return sendJson(res, 200, {
        configured: true,
        selected: getLastWorkingModel(),
        preferred: isAutoModelSetting(ENV_MODEL) ? 'auto' : ENV_MODEL,
        models
      });
    } catch (error) {
      return sendJson(res, 200, {
        configured: true,
        selected: getLastWorkingModel(),
        models: [],
        discoveryError: error.message
      });
    }
  }

  if (req.method === 'POST' && ['/api/extract', '/api/ai/extract'].includes(pathname)) {
    return handleExtract(req, res);
  }

  if (req.method === 'POST' && ['/api/draft', '/api/ai/draft'].includes(pathname)) {
    return handleDraft(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

module.exports = { router };
