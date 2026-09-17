const tls = require('tls');
const net = require('net');
const {
  EMAIL_USER, EMAIL_APP_PASSWORD,
  IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_MAILBOX, EMAIL_ONLY_UNSEEN, EMAIL_MARK_READ,
  EMAIL_AUTO_ACKNOWLEDGE, SMTP_HOST, SMTP_PORT, SMTP_SECURE,
  SAFE_ACK_TEXT, emailConfigured
} = require('../config/env');
const { hasExternalId, logEvent, setIntegrationHealth } = require('./store');
const { processInbound, stableId } = require('./processor');

function quoteImap(value) { return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }
function decodeQuotedPrintable(value = '') {
  return String(value).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function decodeBody(value, encoding = '') {
  const mode = String(encoding).toLowerCase();
  if (mode.includes('base64')) {
    try { return Buffer.from(String(value).replace(/\s+/g, ''), 'base64').toString('utf8'); } catch { return String(value); }
  }
  if (mode.includes('quoted-printable')) return decodeQuotedPrintable(value);
  return String(value);
}
function parseHeaders(raw = '') {
  const unfolded = String(raw).replace(/\r?\n[ \t]+/g, ' ');
  const map = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (map[key]) map[key] += `, ${value}`; else map[key] = value;
  }
  return map;
}
function stripHtml(html = '') {
  return String(html).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}
function extractTextBody(headerMap, body = '') {
  const contentType = String(headerMap['content-type'] || 'text/plain');
  const encoding = String(headerMap['content-transfer-encoding'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const parts = String(body).split(`--${boundary}`);
    let htmlFallback = '';
    for (const part of parts) {
      const split = part.search(/\r?\n\r?\n/);
      if (split < 0) continue;
      const partHeaders = parseHeaders(part.slice(0, split));
      const partBody = part.slice(split).replace(/^\r?\n\r?\n/, '').replace(/\r?\n--$/, '');
      const type = String(partHeaders['content-type'] || '').toLowerCase();
      const decoded = decodeBody(partBody, partHeaders['content-transfer-encoding']);
      if (type.includes('text/plain')) return decoded.trim();
      if (type.includes('text/html') && !htmlFallback) htmlFallback = stripHtml(decoded);
    }
    return htmlFallback.trim();
  }
  const decoded = decodeBody(body, encoding);
  return contentType.toLowerCase().includes('text/html') ? stripHtml(decoded) : decoded.trim();
}
function parseRawEmail(raw = '') {
  const index = String(raw).search(/\r?\n\r?\n/);
  const headerRaw = index >= 0 ? raw.slice(0, index) : raw;
  const bodyRaw = index >= 0 ? raw.slice(index).replace(/^\r?\n\r?\n/, '') : '';
  const headers = parseHeaders(headerRaw);
  const from = headers.from || '';
  const match = from.match(/^(.*?)\s*<([^>]+)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
  const senderEmail = match ? (match[2] || match[1] || '').trim() : '';
  const senderName = match && match[2] ? String(match[1] || '').replace(/^"|"$/g, '').trim() : '';
  return {
    headers,
    subject: headers.subject || 'New email service request',
    messageId: headers['message-id'] || '',
    date: headers.date || '',
    senderEmail,
    senderName,
    text: extractTextBody(headers, bodyRaw)
  };
}
function shouldSkipMail(parsed) {
  const autoSubmitted = String(parsed.headers['auto-submitted'] || '').toLowerCase();
  const precedence = String(parsed.headers.precedence || '').toLowerCase();
  return (autoSubmitted && autoSubmitted !== 'no') || ['bulk', 'list', 'junk'].includes(precedence);
}

class ImapSession {
  constructor() { this.socket = null; this.buffer = ''; this.tag = 0; this.waiters = []; }
  async connect() {
    if (!IMAP_SECURE) throw new Error('This self-contained connector currently requires IMAP_SECURE=true. Gmail uses secure IMAP on port 993.');
    await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: IMAP_HOST, port: IMAP_PORT, servername: IMAP_HOST, rejectUnauthorized: true });
      this.socket = socket;
      const timer = setTimeout(() => reject(new Error('IMAP connection timed out.')), 15000);
      socket.setEncoding('utf8');
      socket.on('data', chunk => { this.buffer += chunk; this.flushWaiters(); });
      socket.once('secureConnect', () => {
        const waitGreeting = () => {
          if (/^\* (OK|PREAUTH)/m.test(this.buffer)) { clearTimeout(timer); resolve(); }
          else setTimeout(waitGreeting, 20);
        };
        waitGreeting();
      });
      socket.once('error', error => { clearTimeout(timer); reject(error); });
    });
  }
  flushWaiters() {
    for (const waiter of [...this.waiters]) {
      if (waiter.test(this.buffer)) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(this.buffer);
      }
    }
  }
  async command(command) {
    const tag = `A${String(++this.tag).padStart(4, '0')}`;
    this.buffer = '';
    this.socket.write(`${tag} ${command}\r\n`);
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item !== waiter);
        reject(new Error(`IMAP command timed out: ${command.split(' ')[0]}`));
      }, 20000);
      const waiter = {
        test: buffer => new RegExp(`(?:^|\\r?\\n)${tag} (?:OK|NO|BAD)`, 'm').test(buffer),
        resolve: buffer => { clearTimeout(timer); resolve(buffer); }
      };
      this.waiters.push(waiter);
      this.flushWaiters();
    });
    const completion = response.match(new RegExp(`${tag} (OK|NO|BAD)\\s*([^\\r\\n]*)`, 'i'));
    if (!completion || completion[1].toUpperCase() !== 'OK') throw new Error(`IMAP rejected command: ${completion?.[2] || 'unknown response'}`);
    return response;
  }
  close() { try { this.socket?.end(); } catch {} }
}

function literalFromFetch(response = '') {
  const marker = response.match(/BODY(?:\.PEEK)?\[\]\s*\{(\d+)\}\r?\n/i);
  if (!marker) return '';
  const start = marker.index + marker[0].length;
  const length = Number(marker[1]);
  return response.slice(start, start + length);
}
function internalDateFromFetch(response = '') {
  const match = response.match(/INTERNALDATE\s+"([^"]+)"/i);
  return match ? match[1] : '';
}

async function withMailbox(fn) {
  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN ${quoteImap(EMAIL_USER)} ${quoteImap(EMAIL_APP_PASSWORD)}`);
    await session.command(`SELECT ${quoteImap(IMAP_MAILBOX)}`);
    return await fn(session);
  } finally {
    try { await session.command('LOGOUT'); } catch {}
    session.close();
  }
}

async function smtpRead(socket, expectedCodes) {
  let buffer = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => cleanup(new Error('SMTP response timed out.')), 15000);
    const onData = chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3} /.test(last)) {
        const code = Number(last.slice(0, 3));
        if (expectedCodes.includes(code)) cleanup(null, buffer);
        else cleanup(new Error(`SMTP error ${code}: ${last.slice(4)}`));
      }
    };
    const onError = error => cleanup(error);
    function cleanup(error, value) {
      clearTimeout(timer); socket.off('data', onData); socket.off('error', onError);
      if (error) reject(error); else resolve(value);
    }
    socket.on('data', onData); socket.on('error', onError);
  });
}
async function smtpCommand(socket, command, codes) {
  socket.write(`${command}\r\n`);
  return smtpRead(socket, codes);
}
async function openSmtpSocket() {
  if (!SMTP_SECURE) throw new Error('This self-contained connector currently requires SMTP_SECURE=true. For Gmail use smtp.gmail.com:465.');
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST, rejectUnauthorized: true });
    const timer = setTimeout(() => reject(new Error('SMTP connection timed out.')), 15000);
    socket.once('secureConnect', async () => {
      clearTimeout(timer);
      try { await smtpRead(socket, [220]); resolve(socket); } catch (error) { reject(error); }
    });
    socket.once('error', error => { clearTimeout(timer); reject(error); });
  });
}
async function sendAcknowledgement({ to, subject, inReplyTo }) {
  if (!EMAIL_AUTO_ACKNOWLEDGE || !to) return false;
  const socket = await openSmtpSocket();
  try {
    await smtpCommand(socket, 'EHLO serviceflow.local', [250]);
    await smtpCommand(socket, 'AUTH LOGIN', [334]);
    await smtpCommand(socket, Buffer.from(EMAIL_USER).toString('base64'), [334]);
    await smtpCommand(socket, Buffer.from(EMAIL_APP_PASSWORD).toString('base64'), [235]);
    await smtpCommand(socket, `MAIL FROM:<${EMAIL_USER}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, 'DATA', [354]);
    const safeSubject = /^re:/i.test(subject || '') ? subject : `Re: ${subject || 'Service request'}`;
    const message = [
      `From: ${EMAIL_USER}`, `To: ${to}`, `Subject: ${safeSubject}`,
      ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
      'Auto-Submitted: auto-replied', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', SAFE_ACK_TEXT
    ].join('\r\n').replace(/^\./gm, '..');
    socket.write(`${message}\r\n.\r\n`);
    await smtpRead(socket, [250]);
    await smtpCommand(socket, 'QUIT', [221]);
    return true;
  } finally { socket.end(); }
}

async function verifyEmailConnection() {
  if (!emailConfigured()) return { configured: false, ok: false, message: 'Email credentials not configured.' };
  try {
    await withMailbox(async session => session.command('NOOP'));
    const health = { status: 'healthy', lastSuccessAt: new Date().toISOString(), lastError: '' };
    setIntegrationHealth('email', health);
    return { configured: true, ok: true, message: `Connected to ${EMAIL_USER} via IMAP. No Google Cloud project is used.` };
  } catch (error) {
    setIntegrationHealth('email', { status: 'error', lastError: error.message, lastErrorAt: new Date().toISOString() });
    throw error;
  }
}

async function syncGmail() {
  if (!emailConfigured()) return { configured: false, discovered: 0, imported: 0, acknowledged: 0, skipped: 0 };
  let imported = 0, acknowledged = 0, skipped = 0, discovered = 0;
  setIntegrationHealth('email', { status: 'syncing', lastAttemptAt: new Date().toISOString(), lastError: '' });
  try {
    await withMailbox(async session => {
      const searchResponse = await session.command(`UID SEARCH ${EMAIL_ONLY_UNSEEN ? 'UNSEEN' : 'ALL'}`);
      const searchLine = searchResponse.split(/\r?\n/).find(line => /^\* SEARCH/i.test(line)) || '';
      const uids = searchLine.replace(/^\* SEARCH\s*/i, '').trim().split(/\s+/).filter(Boolean).slice(-30);
      discovered = uids.length;
      for (const uid of uids) {
        const fetchResponse = await session.command(`UID FETCH ${uid} (UID INTERNALDATE BODY.PEEK[])`);
        const raw = literalFromFetch(fetchResponse);
        if (!raw) { skipped += 1; continue; }
        const parsed = parseRawEmail(raw);
        if (shouldSkipMail(parsed) || !parsed.text) { skipped += 1; continue; }
        const externalId = `email:${stableId(parsed.messageId || `${EMAIL_USER}:${uid}:${parsed.subject}`)}`;
        if (hasExternalId(externalId)) { skipped += 1; continue; }
        const rawInbound = {
          externalId, source: 'Email', from: parsed.senderName || parsed.senderEmail, senderEmail: parsed.senderEmail,
          subject: parsed.subject, body: parsed.text,
          receivedAt: new Date(internalDateFromFetch(fetchResponse) || parsed.date || Date.now()).toISOString(),
          metadata: { imapUid: uid, messageId: parsed.messageId, mailbox: IMAP_MAILBOX }
        };
        try {
          const item = await processInbound(rawInbound);
          imported += 1;
          logEvent({ source: 'Email', type: 'captured', message: `Captured email: ${parsed.subject}`, itemId: item.id, details: { from: parsed.senderEmail } });
          if (EMAIL_MARK_READ) await session.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
          if (EMAIL_AUTO_ACKNOWLEDGE && parsed.senderEmail && item.automationReady) {
            if (await sendAcknowledgement({ to: parsed.senderEmail, subject: parsed.subject, inReplyTo: parsed.messageId })) {
              acknowledged += 1;
              logEvent({ source: 'Email', type: 'acknowledgement', message: `Safe acknowledgement sent to ${parsed.senderEmail}`, itemId: item.id });
            }
          }
        } catch (error) {
          logEvent({ source: 'Email', level: 'error', type: 'processing-failed', message: error.message, details: { subject: parsed.subject } });
        }
      }
    });
    const now = new Date().toISOString();
    setIntegrationHealth('email', { status: 'healthy', lastSuccessAt: now, lastAttemptAt: now, lastError: '', imported, discovered });
    logEvent({ source: 'Email', type: 'sync', message: `Mailbox sync complete: ${imported} imported, ${skipped} skipped.` });
    return { configured: true, discovered, imported, acknowledged, skipped };
  } catch (error) {
    setIntegrationHealth('email', { status: 'error', lastError: error.message, lastErrorAt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() });
    logEvent({ source: 'Email', level: 'error', type: 'sync-failed', message: error.message });
    throw new Error(`Mailbox sync failed: ${error.message}`);
  }
}

module.exports = { syncGmail, verifyEmailConnection, sendAcknowledgement, parseRawEmail };
