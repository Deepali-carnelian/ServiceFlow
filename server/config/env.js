const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const ENV_MODEL = (process.env.GEMINI_MODEL || 'auto').trim();
const MODEL_CACHE_MS = 10 * 60 * 1000;

function geminiConfigured() {
  return Boolean(
    GEMINI_API_KEY &&
    GEMINI_API_KEY !== 'PASTE_YOUR_GEMINI_API_KEY_HERE'
  );
}

module.exports = {
  ROOT,
  PORT,
  GEMINI_API_KEY,
  ENV_MODEL,
  MODEL_CACHE_MS,
  geminiConfigured
};
