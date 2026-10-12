const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const settings = require('./settings');
const library = require('./library');
const recorders = require('./recorders');
const { AUDIO_EXTENSIONS, isAudioFile, fingerprint } = require('./audio');
const { transcribe } = require('./transcribe');
const { summarize } = require('./summarize');
const { templateOptions } = require('./templates');
const { transcriptMarkdown, summaryMarkdown } = require('./markdown');
const { createMarkdownPage } = require('./notion');

const ICON_PATH = path.join(__dirname, '..', 'renderer', 'assets', 'icon.png');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 820,
    minWidth: 560,
    minHeight: 560,
    title: 'Anvil Notes',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on('closed', () => (mainWindow = null));
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// ---------- Helpers ----------

function safeFileName(name) {
  return name.replace(/:/g, '.').replace(/[\\/*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Recording';
}

function defaultOutputFolder() {
  return path.join(app.getPath('documents'), 'Anvil Notes');
}

function describeFile(filePath) {
  const { size, mtimeMs } = fs.statSync(filePath);
  const name = path.basename(filePath);
  return { path: filePath, name, size, mtimeMs, fingerprint: fingerprint({ name, size, mtimeMs }) };
}

// Use the Mac's region settings (e.g. "7 October 2026, 23:29" in the UK).
const locale = () => app.getSystemLocale() || undefined;

function formatRecordedAt(mtimeMs) {
  const d = new Date(mtimeMs);
  return `${d.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`;
}

// Recorder file names like "REC001", "VOICE_0007" or "20261007_1432" say
// nothing useful, so title those by recording time instead.
function defaultTitle(filePath, mtimeMs) {
  const base = path.basename(filePath, path.extname(filePath));
  const generic = /^((rec|record|recording|voice|audio|memo|vn|track|new recording|tr)[\s_-]*)?[\d\s_.-]+$/i;
  if (!generic.test(base)) return base;
  const d = new Date(mtimeMs);
  return `Recording ${d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`;
}

// Writes into the chosen folder as "2026-10-07 Title.md", adding " (2)" etc. if needed.
function writeMarkdownToFolder(folder, title, markdown, mtimeMs) {
  fs.mkdirSync(folder, { recursive: true });
  const day = new Date(mtimeMs).toISOString().slice(0, 10);
  const base = `${day} ${safeFileName(title)}`;
  let target = path.join(folder, `${base}.md`);
  for (let n = 2; fs.existsSync(target); n++) target = path.join(folder, `${base} (${n}).md`);
  fs.writeFileSync(target, markdown, 'utf8');
  return target;
}

// ---------- Settings, files and links ----------

ipcMain.handle('settings:get', () => ({ ...settings.load(), defaultOutputFolder: defaultOutputFolder(), appVersion: require('../package.json').version }));
ipcMain.handle('settings:save', (_e, updates) => ({ ...settings.save(updates), defaultOutputFolder: defaultOutputFolder() }));
ipcMain.handle('templates:list', () => templateOptions());

ipcMain.handle('files:choose', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
  });
  return canceled ? [] : filePaths.map(describeFile);
});

// Dropped files arrive as paths; stat them here and keep only audio.
ipcMain.handle('files:describe', (_e, paths) =>
  paths.filter((p) => typeof p === 'string' && isAudioFile(p) && fs.existsSync(p)).map(describeFile)
);

ipcMain.handle('folder:choose', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: settings.load().outputFolder || defaultOutputFolder(),
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('file:saveMarkdown', async (_e, { title, markdown }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(settings.load().outputFolder || defaultOutputFolder(), `${safeFileName(title)}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, markdown, 'utf8');
  return filePath;
});

ipcMain.handle('link:open', (_e, target) => {
  if (/^https:\/\/(www\.)?notion\.(so|com)\//.test(target)) shell.openExternal(target);
});

ipcMain.handle('file:reveal', (_e, filePath) => {
  if (typeof filePath === 'string' && filePath.endsWith('.md')) shell.showItemInFolder(filePath);
});

// ---------- Recorders ----------

let knownVolumes = new Set();

function scanRecorders({ notify = false } = {}) {
  const found = recorders.findNewRecordings(settings.load().ignoredVolumes || []);
  if (notify) {
    for (const v of found) {
      if (knownVolumes.has(v.name) || !Notification.isSupported()) continue;
      if (mainWindow?.isFocused()) continue;
      const n = new Notification({
        title: `${v.name} connected`,
        body: `${v.files.length} new recording${v.files.length === 1 ? '' : 's'} ready to import`,
      });
      n.on('click', () => mainWindow?.show());
      n.show();
    }
  }
  knownVolumes = new Set(found.map((v) => v.name));
  return found;
}

ipcMain.handle('recorders:scan', () => scanRecorders());
ipcMain.handle('recorders:markDone', (_e, fingerprints) => library.markProcessed(fingerprints));
ipcMain.handle('recorders:ignore', (_e, volumeName) => {
  const ignored = new Set(settings.load().ignoredVolumes || []);
  ignored.add(volumeName);
  settings.save({ ignoredVolumes: [...ignored] });
});
ipcMain.handle('recorders:unignoreAll', () => settings.save({ ignoredVolumes: [] }));

// ---------- Processing one recording ----------

ipcMain.handle('process:run', async (event, options) => {
  const { jobId, filePath, title, mode, templateId, sendToNotion, saveLocal, includeTranscript } = options;
  const send = (step, detail) => event.sender.send('process:progress', { jobId, step, detail });
  const current = settings.load();

  // Check what we need up front so a missing key doesn't waste a transcription.
  if (!sendToNotion && !saveLocal) throw new Error('Choose at least one destination: Notion or a Markdown file.');
  if (mode === 'summary' && !current.anthropicApiKey) throw new Error('Add your Claude API key in Settings to use summaries.');
  if (sendToNotion && (!current.notionToken || !current.notionParentPageId)) {
    throw new Error('Add your Notion token and parent page in Settings, or untick "Upload to Notion".');
  }
  if (!fs.existsSync(filePath)) throw new Error('The file is no longer there. Was the recorder unplugged?');

  const file = describeFile(filePath);
  const recordedAt = formatRecordedAt(file.mtimeMs);

  send('transcribing');
  const text = await transcribe(filePath, current, (status) => send('status', status));

  let summary = null;
  if (mode === 'summary') {
    send('summarizing');
    summary = await summarize(text, current, templateId);
  }

  const pageTitle = title?.trim() || summary?.title || defaultTitle(filePath, file.mtimeMs);
  const markdown = summary
    ? summaryMarkdown({ title: pageTitle, summary, text, fileName: file.name, date: recordedAt, includeTranscript, templateId })
    : transcriptMarkdown({ title: pageTitle, text, fileName: file.name, date: recordedAt });

  // Save locally first so the file is safe even if the Notion upload fails.
  let savedPath = null;
  if (saveLocal) {
    send('saving');
    savedPath = writeMarkdownToFolder(current.outputFolder || defaultOutputFolder(), pageTitle, markdown, file.mtimeMs);
  }

  let url = null;
  let notionError = null;
  if (sendToNotion) {
    send('uploading');
    try {
      url = await createMarkdownPage({
        token: current.notionToken,
        parentPageId: current.notionParentPageId,
        title: pageTitle,
        markdown,
      });
    } catch (err) {
      notionError = err.message || String(err);
    }
  }

  // Remember it, so a recorder doesn't offer it again.
  if (savedPath || url) library.markProcessed(file.fingerprint);

  send('done');
  return { title: pageTitle, markdown, taskCount: summary?.tasks.length ?? 0, url, savedPath, notionError };
});

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  // Packaged builds take the icon from build/icon.icns; this covers `npm start`.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock.setIcon(ICON_PATH);
  createWindow();

  recorders.watchVolumes(() => {
    const found = scanRecorders({ notify: true });
    mainWindow?.webContents.send('recorders:update', found);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
