const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
};

const state = {
  settings: null,
  queue: [], // { id, file, title, status, step, detail, result, error }
  running: false,
  stopRequested: false,
  selectedJobId: null,
  recorders: [], // [{ name, path, files: [...] }]
  recorderOpen: false,
};
let nextJobId = 1;

// ---------- Formatting ----------
const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const formatDate = (ms) =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const tidyError = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

// ---------- Tabs ----------
function showView(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $('#view-main').hidden = name !== 'main';
  $('#view-settings').hidden = name !== 'settings';
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

// ---------- Choices ----------
const MODE_HINTS = {
  transcript: 'The complete transcript, split into readable paragraphs.',
  summary: 'Claude writes a summary and turns action items into Notion to-dos. Pick a template to suit the recording.',
};

function choices() {
  return {
    mode: document.querySelector('input[name=mode]:checked').value,
    templateId: $('#template').value || 'auto',
    sendToNotion: $('#send-notion').checked,
    saveLocal: $('#save-local').checked,
    includeTranscript: $('#include-transcript').checked,
  };
}

function rememberChoices() {
  const c = choices();
  window.api.saveSettings({
    mode: c.mode,
    template: c.templateId,
    sendToNotion: c.sendToNotion,
    saveLocal: c.saveLocal,
    includeTranscript: c.includeTranscript,
  });
}

function syncChoices() {
  const { mode, saveLocal } = choices();
  $('#mode-hint').textContent = MODE_HINTS[mode];
  $('#summary-options').hidden = mode !== 'summary';
  $('#folder-row').hidden = !saveLocal;
  updateRunButton();
}

document.querySelectorAll('input[name=mode], #template, #send-notion, #save-local, #include-transcript').forEach((node) =>
  node.addEventListener('change', () => {
    syncChoices();
    rememberChoices();
  })
);

function missingSetup() {
  const s = state.settings;
  if (!s) return [];
  const c = choices();
  const missing = [];
  if (s.transcriber === 'openwhispr-cloud' && !s.openwhisprApiKey) missing.push('an OpenWhispr API key');
  if (s.transcriber === 'openai' && !s.openaiApiKey) missing.push('an OpenAI API key');
  if (c.mode === 'summary' && !s.anthropicApiKey) missing.push('a Claude API key');
  if (c.sendToNotion && (!s.notionToken || !s.notionParentPageId)) missing.push('your Notion token and parent page');
  return missing;
}

const pendingJobs = () => state.queue.filter((j) => j.status === 'queued');

function updateRunButton() {
  const missing = missingSetup();
  const c = choices();
  const noDestination = !c.sendToNotion && !c.saveLocal;

  const notice = $('#missing');
  if (missing.length) {
    notice.hidden = false;
    notice.replaceChildren(
      `Add ${missing.join(' and ')} in `,
      el('a', { href: '#', textContent: 'Settings', onclick: (e) => (e.preventDefault(), showView('settings')) }),
      '.'
    );
  } else if (noDestination) {
    notice.hidden = false;
    notice.textContent = 'Choose at least one place to send the result.';
  } else {
    notice.hidden = true;
  }

  const n = pendingJobs().length;
  const verb = c.mode === 'summary' ? 'Transcribe and summarise' : 'Transcribe';
  $('#run').textContent = state.running ? 'Processing…' : n > 1 ? `${verb} ${n} recordings` : verb;
  $('#run').disabled = state.running || n === 0 || missing.length > 0 || noDestination;
  $('#stop').hidden = !state.running;
  $('#stop').disabled = state.stopRequested;
}

// ---------- Settings ----------
const form = $('#view-settings');

function syncEngineFields() {
  const engine = form.elements.transcriber.value;
  form.querySelectorAll('[data-engine]').forEach((node) => (node.hidden = node.dataset.engine !== engine));
}

function shortPath(p) {
  return p.replace(/^\/Users\/[^/]+/, '~');
}

function applySettings(s) {
  state.settings = s;
  for (const [key, value] of Object.entries(s)) {
    const field = form.elements[key];
    if (field && typeof value === 'string') field.value = value;
  }
  syncEngineFields();
  $('#folder-path').textContent = shortPath(s.outputFolder || s.defaultOutputFolder);
  const ignored = s.ignoredVolumes || [];
  $('#ignored-list').textContent = ignored.length ? ignored.join(', ') : 'none';
  $('#unignore').hidden = ignored.length === 0;
  updateRunButton();
}

form.elements.transcriber.addEventListener('change', syncEngineFields);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const updates = Object.fromEntries(new FormData(form).entries());
  for (const k of Object.keys(updates)) updates[k] = updates[k].trim();
  applySettings(await window.api.saveSettings(updates));
  $('#saved').hidden = false;
  setTimeout(() => ($('#saved').hidden = true), 1500);
});

$('#unignore').addEventListener('click', async () => {
  applySettings(await window.api.unignoreAllRecorders());
  refreshRecorders();
});

$('#folder-change').addEventListener('click', async () => {
  const folder = await window.api.chooseFolder();
  if (folder) applySettings(await window.api.saveSettings({ outputFolder: folder }));
});

// ---------- Queue ----------
function addToQueue(files) {
  const queued = new Set(state.queue.filter((j) => j.status !== 'done').map((j) => j.file.fingerprint));
  let added = 0;
  for (const file of files) {
    if (queued.has(file.fingerprint)) continue;
    state.queue.push({ id: nextJobId++, file, title: '', status: 'queued', step: null, detail: '', result: null, error: null });
    queued.add(file.fingerprint);
    added++;
  }
  renderQueue();
  renderRecorders();
  return added;
}

const STATUS_TEXT = {
  queued: 'Waiting',
  transcribing: 'Transcribing…',
  summarizing: 'Summarising with Claude…',
  saving: 'Saving Markdown file…',
  uploading: 'Creating Notion page…',
};

function jobStatusText(job) {
  if (job.status === 'failed') return `Failed: ${job.error}`;
  if (job.status === 'done') {
    const r = job.result;
    const parts = [];
    if (choicesAtRun(job).mode === 'summary') parts.push(r.taskCount ? plural(r.taskCount, 'task') : 'No tasks');
    if (r.url) parts.push('Uploaded to Notion');
    if (r.savedPath) parts.push('Markdown saved');
    if (r.notionError) parts.push(`Notion upload failed: ${r.notionError}`);
    return parts.join(' · ');
  }
  if (job.status === 'running') return job.detail || STATUS_TEXT[job.step] || 'Working…';
  return STATUS_TEXT.queued;
}

function choicesAtRun(job) {
  return job.options || choices();
}

function jobRow(job) {
  const icon = { queued: '○', running: '◐', done: job.result?.notionError ? '!' : '✓', failed: '✕' }[job.status];
  const title =
    job.status === 'done'
      ? el('div', { className: 'job-title-done', textContent: job.result.title })
      : el('input', {
          className: 'job-title',
          type: 'text',
          value: job.title,
          placeholder: 'Title (automatic)',
          disabled: job.status !== 'queued',
          oninput: (e) => (job.title = e.target.value),
        });

  const links = el('div', { className: 'job-links' });
  if (job.status === 'done') {
    links.append(el('a', { href: '#', textContent: 'View', onclick: (e) => (e.preventDefault(), selectJob(job.id)) }));
    if (job.result.url) links.append(el('a', { href: '#', textContent: 'Open in Notion', onclick: (e) => (e.preventDefault(), window.api.openLink(job.result.url)) }));
    if (job.result.savedPath) links.append(el('a', { href: '#', textContent: 'Show in Finder', onclick: (e) => (e.preventDefault(), window.api.revealFile(job.result.savedPath)) }));
  }

  const remove =
    job.status === 'running'
      ? null
      : el('button', {
          className: 'link job-remove',
          type: 'button',
          textContent: job.status === 'queued' ? 'Remove' : 'Dismiss',
          onclick: () => {
            state.queue = state.queue.filter((j) => j !== job);
            if (state.selectedJobId === job.id) selectJob(null);
            renderQueue();
            renderRecorders();
          },
        });

  return el(
    'li',
    { className: `job ${job.status}${state.selectedJobId === job.id ? ' selected' : ''}` },
    el('span', { className: 'job-icon', textContent: icon }),
    el(
      'div',
      { className: 'job-main' },
      el('div', { className: 'job-name' }, job.file.name, el('span', { className: 'muted', textContent: ` · ${formatDate(job.file.mtimeMs)} · ${formatSize(job.file.size)}` })),
      title,
      el('div', { className: 'job-status', textContent: jobStatusText(job) }),
      links
    ),
    remove
  );
}

function updateQueueTitle() {
  const batch = state.queue.filter((j) => j.options);
  const finished = batch.filter((j) => j.status === 'done' || j.status === 'failed').length;
  $('#queue-title').textContent = state.running
    ? `Processing ${Math.min(finished + 1, batch.length)} of ${batch.length}`
    : `Queue (${state.queue.length})`;
}

function renderQueue() {
  const list = $('#queue');
  list.replaceChildren(...state.queue.map(jobRow));
  $('#queue-section').hidden = state.queue.length === 0;
  const done = state.queue.filter((j) => j.status === 'done' || j.status === 'failed').length;
  updateQueueTitle();
  $('#queue-clear').hidden = done === 0 || state.running;
  updateRunButton();
}

// Re-render one row without rebuilding the list (keeps focus in title fields).
function renderJob(job) {
  const index = state.queue.indexOf(job);
  const row = $('#queue').children[index];
  if (row) row.replaceWith(jobRow(job));
  updateQueueTitle();
}

$('#queue-clear').addEventListener('click', () => {
  state.queue = state.queue.filter((j) => j.status !== 'done' && j.status !== 'failed');
  selectJob(null);
  renderQueue();
});

function selectJob(id) {
  state.selectedJobId = id;
  const job = state.queue.find((j) => j.id === id);
  $('#result').hidden = !job;
  if (job) {
    $('#result-title').textContent = job.result.title;
    $('#preview').value = job.result.markdown;
    $('#open-notion').hidden = !job.result.url;
  }
  document.querySelectorAll('#queue .job').forEach((row, i) => row.classList.toggle('selected', state.queue[i]?.id === id));
}

// ---------- Adding files ----------
const dropzone = $('#dropzone');

async function chooseFiles() {
  if (state.running) return;
  addToQueue(await window.api.chooseFiles());
}

dropzone.addEventListener('click', chooseFiles);
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    chooseFiles();
  }
});
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.remove('over')));
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = await window.api.describeFiles(e.dataTransfer.files);
  if (!files.length) {
    flashDropzone('Those files aren’t a supported audio format.');
    return;
  }
  addToQueue(files);
});
// Stop the window navigating to a file dropped outside the zone.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

function flashDropzone(message) {
  const span = dropzone.querySelector('span');
  const original = span.textContent;
  span.textContent = message;
  dropzone.classList.add('error-flash');
  setTimeout(() => {
    span.textContent = original;
    dropzone.classList.remove('error-flash');
  }, 2500);
}

// ---------- Processing ----------
window.api.onProgress(({ jobId, step, detail }) => {
  const job = state.queue.find((j) => j.id === jobId);
  if (!job || job.status !== 'running') return;
  if (step === 'status') job.detail = detail;
  else if (step !== 'done') {
    job.step = step;
    job.detail = '';
  }
  renderJob(job);
});

$('#run').addEventListener('click', async () => {
  const options = choices();
  const jobs = pendingJobs();
  for (const j of jobs) j.options = options;
  // Forget the run size of earlier batches so "x of y" counts this one.
  for (const j of state.queue) if (!jobs.includes(j)) delete j.options;

  state.running = true;
  state.stopRequested = false;
  renderQueue();

  for (const job of jobs) {
    if (state.stopRequested) break;
    if (!state.queue.includes(job)) continue; // removed while waiting
    job.status = 'running';
    job.step = 'transcribing';
    renderJob(job);
    try {
      job.result = await window.api.run({ jobId: job.id, filePath: job.file.path, title: job.title, ...options });
      job.status = 'done';
    } catch (err) {
      job.status = 'failed';
      job.error = tidyError(err);
    }
    renderJob(job);
    if (job.status === 'done' && (jobs.length === 1 || !state.selectedJobId)) selectJob(job.id);
  }

  state.running = false;
  state.stopRequested = false;
  renderQueue();
  refreshRecorders();
});

$('#stop').addEventListener('click', () => {
  state.stopRequested = true;
  updateRunButton();
});

// ---------- Result preview ----------
$('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#preview').value);
  $('#copy').textContent = 'Copied';
  setTimeout(() => ($('#copy').textContent = 'Copy'), 1200);
});

$('#save-md').addEventListener('click', async () => {
  const job = state.queue.find((j) => j.id === state.selectedJobId);
  if (!job) return;
  if (await window.api.saveMarkdown(job.result.title, job.result.markdown)) {
    $('#save-md').textContent = 'Saved';
    setTimeout(() => ($('#save-md').textContent = 'Save .md'), 1500);
  }
});

$('#open-notion').addEventListener('click', () => {
  const job = state.queue.find((j) => j.id === state.selectedJobId);
  if (job?.result.url) window.api.openLink(job.result.url);
});

// ---------- Recorders ----------
const inQueue = (fp) => state.queue.some((j) => j.file.fingerprint === fp && j.status !== 'failed');

function visibleRecorders() {
  return state.recorders
    .map((v) => ({ ...v, files: v.files.filter((f) => !inQueue(f.fingerprint)) }))
    .filter((v) => v.files.length);
}

function renderRecorders() {
  const volumes = visibleRecorders();
  const total = volumes.reduce((n, v) => n + v.files.length, 0);
  $('#recorder').hidden = total === 0;
  if (!total) return;

  $('#recorder-title').textContent =
    volumes.length === 1 ? `🎙 ${volumes[0].name} connected` : `🎙 ${volumes.length} drives connected`;
  $('#recorder-sub').textContent = ` · ${plural(total, 'new recording')}`;
  $('#recorder-toggle').textContent = state.recorderOpen ? 'Hide' : 'Review';
  $('#recorder-body').hidden = !state.recorderOpen;

  const list = $('#recorder-files');
  list.replaceChildren(
    ...volumes.flatMap((v) => [
      el(
        'li',
        { className: 'volume-head' },
        el('strong', { textContent: v.name }),
        el('button', {
          type: 'button',
          className: 'link',
          textContent: 'Ignore this drive',
          title: 'Stop offering recordings from this drive (undo in Settings)',
          onclick: async () => {
            await window.api.ignoreRecorder(v.name);
            applySettings(await window.api.getSettings());
            refreshRecorders();
          },
        })
      ),
      ...v.files.map((f) =>
        el(
          'li',
          {},
          el(
            'label',
            { className: 'check' },
            el('input', { type: 'checkbox', checked: true, value: f.fingerprint }),
            el('span', {}, f.name, el('span', { className: 'muted', textContent: ` · ${formatDate(f.mtimeMs)} · ${formatSize(f.size)}` }))
          )
        )
      ),
    ])
  );
  $('#recorder-all').checked = true;
}

function selectedRecorderFiles() {
  const chosen = new Set([...document.querySelectorAll('#recorder-files input:checked')].map((i) => i.value));
  return visibleRecorders().flatMap((v) => v.files).filter((f) => chosen.has(f.fingerprint));
}

$('#recorder-toggle').addEventListener('click', () => {
  state.recorderOpen = !state.recorderOpen;
  renderRecorders();
});

$('#recorder-all').addEventListener('change', (e) => {
  document.querySelectorAll('#recorder-files input[type=checkbox]').forEach((i) => (i.checked = e.target.checked));
});

$('#recorder-add').addEventListener('click', () => {
  const files = selectedRecorderFiles();
  if (!files.length) return;
  addToQueue(files);
});

$('#recorder-done').addEventListener('click', async () => {
  const files = selectedRecorderFiles();
  if (!files.length) return;
  await window.api.markRecordingsDone(files.map((f) => f.fingerprint));
  refreshRecorders();
});

async function refreshRecorders() {
  state.recorders = await window.api.scanRecorders();
  renderRecorders();
}

window.api.onRecordersUpdate((volumes) => {
  const hadAny = visibleRecorders().length > 0;
  state.recorders = volumes;
  // Open the list straight away when a recorder is plugged in and nothing else is going on.
  if (!hadAny && visibleRecorders().length && !state.running && state.queue.length === 0) state.recorderOpen = true;
  renderRecorders();
});

// ---------- Init ----------
(async () => {
  const [s, templates] = await Promise.all([window.api.getSettings(), window.api.listTemplates()]);
  $('#template').replaceChildren(...templates.map((t) => el('option', { value: t.id, textContent: t.label })));
  $('#template').value = s.template || 'auto';
  document.querySelector(`input[name=mode][value=${s.mode === 'summary' ? 'summary' : 'transcript'}]`).checked = true;
  $('#send-notion').checked = s.sendToNotion !== false;
  $('#save-local').checked = !!s.saveLocal;
  $('#include-transcript').checked = s.includeTranscript !== false;
  applySettings(s);
  syncChoices();
  if (missingSetup().length) showView('settings');

  await refreshRecorders();
  if (visibleRecorders().length) state.recorderOpen = true;
  renderRecorders();
})();
