const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, cb) {
  const listener = (_e, data) => cb(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (updates) => ipcRenderer.invoke('settings:save', updates),
  listTemplates: () => ipcRenderer.invoke('templates:list'),

  chooseFiles: () => ipcRenderer.invoke('files:choose'),
  describeFiles: (files) => ipcRenderer.invoke('files:describe', [...files].map((f) => webUtils.getPathForFile(f))),
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  saveMarkdown: (title, markdown) => ipcRenderer.invoke('file:saveMarkdown', { title, markdown }),
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),

  scanRecorders: () => ipcRenderer.invoke('recorders:scan'),
  markRecordingsDone: (fingerprints) => ipcRenderer.invoke('recorders:markDone', fingerprints),
  ignoreRecorder: (name) => ipcRenderer.invoke('recorders:ignore', name),
  unignoreAllRecorders: () => ipcRenderer.invoke('recorders:unignoreAll'),
  onRecordersUpdate: (cb) => subscribe('recorders:update', cb),

  run: (options) => ipcRenderer.invoke('process:run', options),
  onProgress: (cb) => subscribe('process:progress', cb),
});
