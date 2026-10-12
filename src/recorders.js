// Detects voice recorders (and other drives) plugged into the Mac and finds
// the audio files on them that haven't been processed yet.
const fs = require('fs');
const path = require('path');
const { isAudioFile, fingerprint } = require('./audio');
const library = require('./library');

const VOLUMES_DIR = '/Volumes';
const MAX_DEPTH = 4;
const MAX_ENTRIES = 5000; // stop scanning big drives (backup disks etc.) early
const SKIP_DIRS = new Set([
  '.Spotlight-V100', '.Trashes', '.fseventsd', '.TemporaryItems', 'System Volume Information',
  'Library', 'Applications', 'System', 'node_modules', '$RECYCLE.BIN',
]);

function listVolumes() {
  if (process.platform !== 'darwin') return [];
  let names = [];
  try {
    names = fs.readdirSync(VOLUMES_DIR);
  } catch {
    return [];
  }
  return names
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(VOLUMES_DIR, name))
    .filter((p) => {
      try {
        return fs.realpathSync(p) !== '/'; // skip the Mac's own disk
      } catch {
        return false;
      }
    });
}

function scanVolume(volumePath) {
  const files = [];
  let visited = 0;

  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH || visited > MAX_ENTRIES) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (++visited > MAX_ENTRIES) return;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && isAudioFile(full)) {
        try {
          const { size, mtimeMs } = fs.statSync(full);
          if (size === 0) continue;
          files.push({ path: full, name: entry.name, size, mtimeMs, fingerprint: fingerprint({ name: entry.name, size, mtimeMs }) });
        } catch {
          // File vanished mid-scan (drive ejected); ignore.
        }
      }
    }
  };

  walk(volumePath, 0);
  return files.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

// Drives with at least one recording that hasn't been processed.
function findNewRecordings(ignoredVolumes = []) {
  return listVolumes()
    .filter((p) => !ignoredVolumes.includes(path.basename(p)))
    .map((volumePath) => {
      const files = scanVolume(volumePath).filter((f) => !library.isProcessed(f.fingerprint));
      return { name: path.basename(volumePath), path: volumePath, files };
    })
    .filter((v) => v.files.length > 0);
}

// Calls onChange whenever a drive is plugged in or ejected.
function watchVolumes(onChange) {
  if (process.platform !== 'darwin') return () => {};
  let timer = null;
  const fire = () => {
    clearTimeout(timer);
    // Give the drive a moment to finish mounting before scanning it.
    timer = setTimeout(onChange, 1500);
  };
  let watcher;
  try {
    watcher = fs.watch(VOLUMES_DIR, fire);
  } catch {
    return () => {};
  }
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

module.exports = { findNewRecordings, watchVolumes, scanVolume };
