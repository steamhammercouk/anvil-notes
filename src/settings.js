// Persists app settings in the user's data folder. API keys are encrypted
// with the OS keychain via Electron's safeStorage when it is available.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const SECRET_KEYS = ['openwhisprApiKey', 'openaiApiKey', 'anthropicApiKey', 'notionToken'];

const DEFAULTS = {
  transcriber: 'openwhispr-local', // 'openwhispr-local' | 'openwhispr-cloud' | 'openai'
  openwhisprModel: '', // optional local model override; blank = the app's current model
  openwhisprApiKey: '',
  openaiApiKey: '',
  openaiModel: 'whisper-1',
  language: '',
  anthropicApiKey: '',
  claudeModel: 'claude-opus-5-5',
  notionToken: '',
  notionParentPageId: '',
  // Last choices on the Transcribe screen
  mode: 'transcript', // 'transcript' | 'summary'
  sendToNotion: true,
  saveLocal: false,
  includeTranscript: true,
  template: 'auto',
  outputFolder: '', // blank = ~/Documents/Anvil Notes
  ignoredVolumes: [], // drives the user chose not to import from
};

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function encrypt(value) {
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) return { plain: value };
  return { enc: safeStorage.encryptString(value).toString('base64') };
}

function decrypt(stored) {
  if (!stored) return '';
  if (typeof stored === 'string') return stored;
  if (stored.plain) return stored.plain;
  if (stored.enc) return safeStorage.decryptString(Buffer.from(stored.enc, 'base64'));
  return '';
}

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    // First run or unreadable file: fall back to defaults.
  }
  const settings = { ...DEFAULTS, ...raw };
  for (const key of SECRET_KEYS) {
    try {
      settings[key] = decrypt(raw[key]);
    } catch {
      settings[key] = '';
    }
  }
  return settings;
}

function save(updates) {
  const settings = { ...load(), ...updates };
  const toWrite = { ...settings };
  for (const key of SECRET_KEYS) toWrite[key] = encrypt(settings[key]);
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(toWrite, null, 2), { mode: 0o600 });
  return settings;
}

module.exports = { load, save };
