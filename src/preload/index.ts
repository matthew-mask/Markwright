import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC, type Settings, type ThemeManifest, type LoadedFile, type UpdateInfo } from '../shared/ipc';

const api = {
  openFileDialog: (): Promise<LoadedFile | null> => ipcRenderer.invoke(IPC.fileOpenDialog),
  loadByPath: (filePath: string): Promise<LoadedFile | null> => ipcRenderer.invoke(IPC.fileLoadByPath, filePath),
  save: (filePath: string, content: string) => ipcRenderer.invoke(IPC.fileSave, { path: filePath, content }),
  saveAsDialog: (content: string): Promise<string | null> => ipcRenderer.invoke(IPC.fileSaveAsDialog, content),
  getInitialFile: (): Promise<LoadedFile | null> => ipcRenderer.invoke(IPC.fileGetInitial),

  listThemes: (): Promise<ThemeManifest[]> => ipcRenderer.invoke(IPC.themesList),
  loadThemeCss: (themeId: string): Promise<string | null> => ipcRenderer.invoke(IPC.themesLoadCss, themeId),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (partial: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke(IPC.settingsSet, partial),

  setWindowTitle: (title: string) => ipcRenderer.invoke(IPC.windowSetTitle, title),

  onExternalFileOpen: (cb: (filePath: string) => void) => {
    ipcRenderer.on('file:openExternal', (_e, filePath: string) => cb(filePath));
  },

  onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update:downloaded', (_e, info: UpdateInfo) => cb(info));
  },
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall),

  // Resolve the absolute path of a File object dropped onto the window.
  // Electron 32+ removed File.path for security; webUtils.getPathForFile is the replacement.
  getDroppedFilePath: (file: File): string => webUtils.getPathForFile(file)
};

contextBridge.exposeInMainWorld('markwright', api);

export type MarkwrightAPI = typeof api;
