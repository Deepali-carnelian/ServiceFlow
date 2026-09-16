const http = require('http');
const { PORT, geminiConfigured } = require('./server/config/env');
const { getCandidateModels } = require('./server/ai/modelRegistry');
const { router } = require('./server/router');

const server = http.createServer(router);

server.listen(PORT, async () => {
  console.log(`\nServiceFlow running at http://localhost:${PORT}`);

  if (!geminiConfigured()) {
    console.log('LLM mode: demo fallback — add GEMINI_API_KEY to .env\n');
    return;
  }

  console.log('LLM mode: Gemini automatic model selection');

  try {
    const candidates = await getCandidateModels(true);
    console.log(`Compatible Gemini text models found: ${candidates.length}`);
    if (candidates.length) console.log(`First-choice model: ${candidates[0]}`);
  } catch {
    console.log('Gemini model discovery will retry on the first AI request.');
  }

  console.log('');
});
