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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function bool(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function number(name, defaultValue) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

loadEnvFile();

const PORT = number('PORT', 3000);
const HOST = (process.env.HOST || '127.0.0.1').trim();
const AUTO_PORT_FALLBACK = bool('AUTO_PORT_FALLBACK', true);

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
const ENV_MODEL = (process.env.GEMINI_MODEL || 'auto').trim();
const MODEL_CACHE_MS = 10 * 60 * 1000;
const AI_TIMEOUT_MS = number('AI_TIMEOUT_MS', 20_000);

const AUTO_CREATE_LEADS = bool('AUTO_CREATE_LEADS', true);
const AUTOMATION_CLIENT_POLL_MS = Math.max(5_000, number('AUTOMATION_CLIENT_POLL_MS', 15_000));
const AUTO_ACKNOWLEDGE_SMS = bool('AUTO_ACKNOWLEDGE_SMS', true);
const SAFE_ACK_TEXT = (process.env.SAFE_ACK_TEXT || "Thanks for contacting our service team. We've received your request and added it to the service queue. If this is an emergency involving product loss, please call the office.").trim();
const WEBSITE_WEBHOOK_SECRET = (process.env.WEBSITE_WEBHOOK_SECRET || '').trim();

// Gmail / generic mailbox integration without Google Cloud.
// For Gmail, use a Google App Password (2-Step Verification must be enabled).
const EMAIL_USER = (process.env.EMAIL_USER || process.env.GMAIL_EMAIL || '').trim();
const EMAIL_APP_PASSWORD = (process.env.EMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '').trim();
const IMAP_HOST = (process.env.IMAP_HOST || 'imap.gmail.com').trim();
const IMAP_PORT = Math.max(1, number('IMAP_PORT', 993));
const IMAP_SECURE = bool('IMAP_SECURE', true);
const IMAP_MAILBOX = (process.env.IMAP_MAILBOX || 'INBOX').trim();
const EMAIL_ONLY_UNSEEN = bool('EMAIL_ONLY_UNSEEN', true);
const EMAIL_MARK_READ = bool('EMAIL_MARK_READ', false);
const EMAIL_POLL_SECONDS = Math.max(30, number('EMAIL_POLL_SECONDS', number('GMAIL_POLL_SECONDS', 60)));
const EMAIL_AUTO_ACKNOWLEDGE = bool('EMAIL_AUTO_ACKNOWLEDGE', bool('GMAIL_AUTO_ACKNOWLEDGE', false));
const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Math.max(1, number('SMTP_PORT', 465));
const SMTP_SECURE = bool('SMTP_SECURE', true);

const TWILIO_WEBHOOK_SECRET = (process.env.TWILIO_WEBHOOK_SECRET || '').trim();
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

function geminiConfigured() {
  return Boolean(GEMINI_API_KEY && !GEMINI_API_KEY.startsWith('PASTE_'));
}
function emailConfigured() {
  return Boolean(EMAIL_USER && EMAIL_APP_PASSWORD && IMAP_HOST);
}
// Backward-compatible alias used by a few UI/server paths.
function gmailConfigured() { return emailConfigured(); }

module.exports = {
  ROOT, PORT, HOST, AUTO_PORT_FALLBACK,
  GEMINI_API_KEY, ENV_MODEL, MODEL_CACHE_MS, AI_TIMEOUT_MS,
  AUTO_CREATE_LEADS, AUTOMATION_CLIENT_POLL_MS, AUTO_ACKNOWLEDGE_SMS, SAFE_ACK_TEXT, WEBSITE_WEBHOOK_SECRET,
  EMAIL_USER, EMAIL_APP_PASSWORD, IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_MAILBOX, EMAIL_ONLY_UNSEEN, EMAIL_MARK_READ,
  EMAIL_POLL_SECONDS, EMAIL_AUTO_ACKNOWLEDGE, SMTP_HOST, SMTP_PORT, SMTP_SECURE,
  // Legacy names kept so older local .env files do not crash the app.
  GMAIL_POLL_SECONDS: EMAIL_POLL_SECONDS,
  GMAIL_AUTO_ACKNOWLEDGE: EMAIL_AUTO_ACKNOWLEDGE,
  TWILIO_WEBHOOK_SECRET, PUBLIC_BASE_URL,
  geminiConfigured, emailConfigured, gmailConfigured
};
