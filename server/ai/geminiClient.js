const { GEMINI_API_KEY, ENV_MODEL, AI_TIMEOUT_MS, geminiConfigured } = require('../config/env');
const {
  getCandidateModels,
  setLastWorkingModel,
  stripModelPrefix
} = require('./modelRegistry');

async function callSpecificModel({
  model,
  systemInstruction,
  userText,
  jsonOutput,
  temperature,
  allowJsonMimeType = true
}) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = { temperature };
  if (jsonOutput && allowJsonMimeType) generationConfig.responseMimeType = 'application/json';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini request failed with HTTP ${response.status}.`);
    error.status = response.status;
    error.model = model;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || '';
  if (!text) throw new Error('Gemini returned an empty response.');

  return { text, model: data?.modelVersion || model };
}

async function callGeminiAuto({
  systemInstruction,
  userText,
  jsonOutput = false,
  temperature = 0.2
}) {
  if (!geminiConfigured()) throw new Error('Gemini is not configured.');

  let candidates = [];
  try {
    candidates = await getCandidateModels(false);
  } catch (error) {
    console.warn('[Gemini] Model discovery failed:', error.message);
    if (ENV_MODEL && ENV_MODEL.toLowerCase() !== 'auto') {
      candidates = [stripModelPrefix(ENV_MODEL)];
    }
  }

  if (!candidates.length) {
    try {
      candidates = await getCandidateModels(true);
    } catch (error) {
      console.warn('[Gemini] No compatible models could be discovered:', error.message);
    }
  }

  if (!candidates.length) throw new Error('No compatible Gemini text model is available.');

  for (const model of candidates) {
    try {
      const result = await callSpecificModel({
        model,
        systemInstruction,
        userText,
        jsonOutput,
        temperature,
        allowJsonMimeType: true
      });
      setLastWorkingModel(model);
      return result;
    } catch (firstError) {
      if (jsonOutput && firstError.status === 400) {
        try {
          const retry = await callSpecificModel({
            model,
            systemInstruction,
            userText,
            jsonOutput,
            temperature,
            allowJsonMimeType: false
          });
          setLastWorkingModel(model);
          return retry;
        } catch {}
      }
      console.warn(`[Gemini] ${model} failed; trying next compatible model.`);
    }
  }

  throw new Error('Gemini is temporarily unavailable for this request.');
}

function parseModelJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

module.exports = { callGeminiAuto, parseModelJson };
