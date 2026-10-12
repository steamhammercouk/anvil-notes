// Remembers which recordings have already been processed, so a recorder
// only offers new ones when it's plugged in.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let cache = null;

function libraryFile() {
  return path.join(app.getPath('userData'), 'processed.json');
}

function load() {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(fs.readFileSync(libraryFile(), 'utf8')));
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist() {
  fs.mkdirSync(path.dirname(libraryFile()), { recursive: true });
  fs.writeFileSync(libraryFile(), JSON.stringify([...load()]), 'utf8');
}

function isProcessed(fp) {
  return load().has(fp);
}

function markProcessed(fps) {
  const set = load();
  for (const fp of [].concat(fps)) set.add(fp);
  persist();
}

module.exports = { isProcessed, markProcessed };
