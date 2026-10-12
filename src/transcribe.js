// Speech-to-text. Default is OpenWhispr (https://openwhispr.com):
//  - 'openwhispr-local': the OpenWhispr desktop app transcribes on this machine,
//    driven through the OpenWhispr CLI. Free, private, no size limit.
//  - 'openwhispr-cloud': OpenWhispr Cloud REST API (beta, Pro plan, 4 MB/file).
//  - 'openai': OpenAI's hosted Whisper API.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const OpenAI = require('openai');
const { audioMimeType } = require('./audio');

const OPENAI_MAX_BYTES = 25 * 1024 * 1024;
const OPENWHISPR_CLOUD_MAX_BYTES = 4 * 1024 * 1024;
const OPENWHISPR_API = 'https://api.openwhispr.com/api/v1';
// In the installed app this lives in app.asar.unpacked (see "asarUnpack" in
// package.json), because a script inside the app archive can't be launched.
const OPENWHISPR_CLI = path
  .join(__dirname, '..', 'node_modules', '@openwhispr', 'cli', 'dist', 'index.js')
  .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const BRIDGE_FILE = path.join(os.homedir(), '.openwhispr', 'cli-bridge.json');

const sizeMb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

// ---------- OpenWhispr (local, via desktop app) ----------

// Runs the OpenWhispr CLI with Electron's bundled Node and returns stdout.
function runOpenWhisprCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [OPENWHISPR_CLI, ...args], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout)
        : reject(Object.assign(new Error(stderr.trim() || `OpenWhispr CLI exited with code ${code}`), { code, stdout }))
    );
  });
}

async function bridgeReachable() {
  let out;
  try {
    out = await runOpenWhisprCli(['doctor']);
  } catch (err) {
    out = err.stdout; // doctor exits 2 when nothing is reachable but still prints its report
  }
  try {
    return JSON.parse(out).local?.reachable === true;
  } catch {
    return false;
  }
}

// Make sure the OpenWhispr desktop app is running, opening it in the
// background if needed, and wait for its CLI bridge to come up.
async function ensureOpenWhisprRunning(onStatus) {
  if (fs.existsSync(BRIDGE_FILE) && (await bridgeReachable())) return;

  if (process.platform !== 'darwin') {
    throw new Error('Open the OpenWhispr app, then try again.');
  }
  onStatus?.('Opening the OpenWhispr app…');
  await new Promise((resolve, reject) =>
    execFile('open', ['-g', '-a', 'OpenWhispr'], (err) =>
      err ? reject(new Error('Could not open OpenWhispr. Install it from openwhispr.com, or pick another engine in Settings.')) : resolve()
    )
  );

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (fs.existsSync(BRIDGE_FILE) && (await bridgeReachable())) return;
  }
  throw new Error('OpenWhispr opened but did not respond. Check it has finished starting and is signed in, then try again.');
}

async function transcribeWithOpenWhisprLocal(filePath, settings, onStatus) {
  await ensureOpenWhisprRunning(onStatus);
  onStatus?.('Transcribing on this Mac with OpenWhispr…');

  const args = ['--local', 'transcribe', filePath, '--format', 'json'];
  if (settings.openwhisprModel) args.push('--model', settings.openwhisprModel);
  if (settings.language) args.push('--language', settings.language);

  let out;
  try {
    out = await runOpenWhisprCli(args);
  } catch (err) {
    // The CLI appends a long list of model ids to some errors; keep the first line.
    const reason = String(err.message).split('\n')[0];
    if (/no local transcription model/i.test(reason)) {
      throw new Error(
        'OpenWhispr has no local model set up yet. Open OpenWhispr → Settings → Transcription, ' +
          'download a model (Parakeet or Whisper "base" are good starting points) and select it, then try again.'
      );
    }
    throw new Error(`OpenWhispr couldn't transcribe this file: ${reason}`);
  }
  const result = JSON.parse(out);
  return String(result.text || '').trim();
}

// ---------- OpenWhispr Cloud ----------

async function transcribeWithOpenWhisprCloud(filePath, settings) {
  if (!settings.openwhisprApiKey) throw new Error('Add your OpenWhispr API key in Settings.');

  const { size } = fs.statSync(filePath);
  if (size > OPENWHISPR_CLOUD_MAX_BYTES) {
    throw new Error(
      `File is ${sizeMb(size)} MB; OpenWhispr Cloud accepts up to 4 MB per file. ` +
        'Switch to "OpenWhispr (on this Mac)" in Settings, which has no size limit.'
    );
  }

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: audioMimeType(filePath) }), path.basename(filePath));
  if (settings.language) form.append('language', settings.language);

  const res = await fetch(`${OPENWHISPR_API}/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.openwhisprApiKey}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code, message } = body.error || {};
    if (code === 'plan_required') throw new Error('OpenWhispr Cloud needs a Pro or Business plan. Use "OpenWhispr (on this Mac)" for free local transcription.');
    throw new Error(`OpenWhispr Cloud error (${res.status}${code ? ` ${code}` : ''}): ${message || res.statusText}`);
  }
  return String(body.data?.text || '').trim();
}

// ---------- OpenAI Whisper ----------

async function transcribeWithOpenAI(filePath, settings) {
  if (!settings.openaiApiKey) throw new Error('Add your OpenAI API key in Settings.');

  const { size } = fs.statSync(filePath);
  if (size > OPENAI_MAX_BYTES) {
    throw new Error(`File is ${sizeMb(size)} MB; the OpenAI API accepts up to 25 MB. Use OpenWhispr instead.`);
  }

  const client = new OpenAI({ apiKey: settings.openaiApiKey });
  const text = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: settings.openaiModel || 'whisper-1',
    response_format: 'text',
    ...(settings.language ? { language: settings.language } : {}),
  });
  return String(text).trim();
}

async function transcribe(filePath, settings, onStatus) {
  switch (settings.transcriber) {
    case 'openwhispr-cloud':
      return transcribeWithOpenWhisprCloud(filePath, settings);
    case 'openai':
      return transcribeWithOpenAI(filePath, settings);
    default:
      return transcribeWithOpenWhisprLocal(filePath, settings, onStatus);
  }
}

module.exports = { transcribe };
