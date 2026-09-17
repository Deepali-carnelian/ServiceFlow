const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  PORT,
  HOST,
  AUTO_PORT_FALLBACK,
  geminiConfigured,
  emailConfigured,
  EMAIL_POLL_SECONDS,
  ROOT
} = require('./server/config/env');
const { getCandidateModels } = require('./server/ai/modelRegistry');
const { syncGmail } = require('./server/integrations/gmail');
const { router } = require('./server/router');

const server = http.createServer((req, res) => {
  Promise.resolve(router(req, res)).catch(error => {
    console.error('Unhandled request error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal server error.' }));
    } else {
      res.end();
    }
  });
});

function listen(port, attemptsLeft = 10) {
  const onError = error => {
    server.off('listening', onListening);
    if (error.code === 'EADDRINUSE' && AUTO_PORT_FALLBACK && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Trying ${nextPort}...`);
      setTimeout(() => listen(nextPort, attemptsLeft - 1), 100);
      return;
    }
    console.error(`Unable to start ServiceFlow: ${error.message}`);
    process.exitCode = 1;
  };

  const onListening = async () => {
    server.off('error', onError);
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    try {
      fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'data', 'active-port.txt'), String(activePort));
    } catch {}
    console.log(`\nServiceFlow running at http://localhost:${activePort}`);

    if (!geminiConfigured()) {
      console.log('LLM mode: deterministic demo fallback — add a current Gemini auth key to .env for live AI.');
    } else {
      console.log('LLM mode: Gemini automatic model selection');
      try {
        const candidates = await getCandidateModels(true);
        console.log(`Compatible Gemini text models found: ${candidates.length}`);
        if (candidates.length) console.log(`First-choice model: ${candidates[0]}`);
      } catch {
        console.log('Gemini model discovery will retry on the first AI request.');
      }
    }

    if (emailConfigured()) {
      console.log(`Email automation: enabled via IMAP/SMTP App Password (polling every ${EMAIL_POLL_SECONDS}s)`);
      syncGmail().catch(error => console.warn('[Email] Initial sync failed:', error.message));
      const timer = setInterval(() => syncGmail().catch(error => console.warn('[Email] Background sync failed:', error.message)), EMAIL_POLL_SECONDS * 1000);
      timer.unref();
    } else {
      console.log('Email automation: not configured (website/SMS webhook endpoints remain available).');
    }

    console.log('');
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

listen(PORT);
