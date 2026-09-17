function readText(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    let settled = false;

    req.setEncoding('utf8');
    req.on('data', chunk => {
      if (settled) return;
      body += chunk;
      if (body.length > limit) {
        settled = true;
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!settled) resolve(body);
    });
    req.on('error', error => {
      if (!settled) reject(error);
    });
  });
}

async function readJson(req) {
  const body = await readText(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}

async function readForm(req) {
  const body = await readText(req);
  return Object.fromEntries(new URLSearchParams(body));
}

module.exports = { readText, readJson, readForm };
