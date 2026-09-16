const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const skipped = new Set(['node_modules']);

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skipped.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(fullPath);
    return /\.(js|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

let failed = false;
for (const file of collect(root)) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`\nSyntax error: ${path.relative(root, file)}\n${result.stderr}`);
  }
}

if (failed) process.exit(1);
console.log('Syntax check passed for all JavaScript modules.');
