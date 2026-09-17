const {
  GEMINI_API_KEY,
  ENV_MODEL,
  MODEL_CACHE_MS,
  AI_TIMEOUT_MS,
  geminiConfigured
} = require('../config/env');

let modelCache = { fetchedAt: 0, models: [] };
let lastWorkingModel = null;

function stripModelPrefix(name = '') {
  return String(name).replace(/^models\//, '');
}

function isAutoModelSetting(value) {
  return !value || value.toLowerCase() === 'auto';
}

async function fetchAvailableModels(forceRefresh = false) {
  if (!geminiConfigured()) return [];

  const cacheFresh =
    !forceRefresh &&
    modelCache.models.length > 0 &&
    Date.now() - modelCache.fetchedAt < MODEL_CACHE_MS;

  if (cacheFresh) return modelCache.models;

  const discovered = [];
  let pageToken = '';

  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: { 'x-goog-api-key': GEMINI_API_KEY },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || `Unable to list Gemini models (HTTP ${response.status}).`);
    }

    discovered.push(...(Array.isArray(data.models) ? data.models : []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  modelCache = { fetchedAt: Date.now(), models: discovered };
  return discovered;
}

function isCompatibleTextModel(model) {
  const name = stripModelPrefix(model?.name || '').toLowerCase();
  const methods = model?.supportedGenerationMethods || model?.supportedActions || [];
  const supportsGenerateContent = methods.some(method => String(method).toLowerCase() === 'generatecontent');

  if (!supportsGenerateContent || !name.includes('gemini')) return false;

  const specialised = ['embedding', 'embed', 'image', 'imagen', 'veo', 'live', 'tts', 'transcribe', 'aqa'];
  return !specialised.some(pattern => name.includes(pattern));
}

function modelScore(model) {
  const name = stripModelPrefix(model?.name || '').toLowerCase();
  let score = 0;

  if (name.includes('flash')) score += 100;
  if (name.includes('flash-lite') || name.includes('flash_lite')) score -= 8;
  if (!name.includes('preview')) score += 30;
  if (!name.includes('experimental') && !name.includes('exp')) score += 15;
  if (!name.includes('latest')) score += 3;
  if (name.includes('pro')) score += 20;
  score += Math.min(Number(model?.outputTokenLimit || 0) / 10000, 10);

  return score;
}

async function getCandidateModels(forceRefresh = false) {
  const models = await fetchAvailableModels(forceRefresh);
  let candidates = models
    .filter(isCompatibleTextModel)
    .sort((a, b) => modelScore(b) - modelScore(a))
    .map(model => stripModelPrefix(model.name));

  if (!isAutoModelSetting(ENV_MODEL)) {
    const preferred = stripModelPrefix(ENV_MODEL);
    const index = candidates.findIndex(model => model.toLowerCase() === preferred.toLowerCase());
    if (index >= 0) {
      candidates.splice(index, 1);
      candidates.unshift(preferred);
    }
  }

  if (lastWorkingModel) {
    const index = candidates.indexOf(lastWorkingModel);
    if (index >= 0) {
      candidates.splice(index, 1);
      candidates.unshift(lastWorkingModel);
    }
  }

  return [...new Set(candidates)];
}

function setLastWorkingModel(model) {
  lastWorkingModel = model;
}

function getLastWorkingModel() {
  return lastWorkingModel;
}

module.exports = {
  getCandidateModels,
  getLastWorkingModel,
  setLastWorkingModel,
  stripModelPrefix,
  isAutoModelSetting
};
