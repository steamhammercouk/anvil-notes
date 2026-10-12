// Audio formats every transcription engine in the app accepts
// (OpenWhispr local and Cloud, and OpenAI).
const path = require('path');

const AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};

const AUDIO_EXTENSIONS = Object.keys(AUDIO_TYPES).map((ext) => ext.slice(1));

function isAudioFile(filePath) {
  return Object.hasOwn(AUDIO_TYPES, path.extname(filePath).toLowerCase());
}

function audioMimeType(filePath) {
  return AUDIO_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Identifies a recording across re-plugs. Recorders reuse names like REC001
// after files are deleted, so include size and modification time.
function fingerprint({ name, size, mtimeMs }) {
  return `${name}|${size}|${Math.round(mtimeMs)}`;
}

module.exports = { AUDIO_EXTENSIONS, isAudioFile, audioMimeType, fingerprint };
