import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } from 'electron';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { IPC, DEFAULT_SETTINGS, type Settings, type ThemeManifest, type LoadedFile, type SaveResult } from '../shared/ipc';
import { listAllThemes, readThemeCss } from './themes';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

// ---- open-file watching -----------------------------------------------------
// Open files are watched so edits made elsewhere (an AI agent, another editor)
// show up live. We watch each file's parent directory rather than the file:
// many tools save via write-temp-then-rename, which orphans a file-level watcher.

const WATCH_SETTLE_MS = 100;

// Last content we read from or wrote to each open file. A watcher event whose
// content matches this is our own write echoing back, not an external edit.
const knownContent = new Map<string, string>();
// Paths we're writing right now; a read mid-write could see a truncated file.
const selfWriting = new Set<string>();
const dirWatchers = new Map<string, { watcher: FSWatcher; files: Set<string> }>();
const settleTimers = new Map<string, NodeJS.Timeout>();

const sameFileName = (a: string, b: string): boolean =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

async function checkForExternalChange(filePath: string): Promise<void> {
  if (selfWriting.has(filePath)) return;
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return; // mid-rename or deleted; a later event will catch the final state
  }
  if (content === knownContent.get(filePath)) return;
  knownContent.set(filePath, content);
  mainWindow?.webContents.send(IPC.fileChangedOnDisk, { path: filePath, content });
}

function onDirEvent(dir: string, fileName: string | null): void {
  const entry = dirWatchers.get(dir);
  if (!entry) return;
  for (const filePath of entry.files) {
    if (fileName && !sameFileName(path.basename(filePath), fileName)) continue;
    clearTimeout(settleTimers.get(filePath));
    settleTimers.set(
      filePath,
      setTimeout(() => {
        settleTimers.delete(filePath);
        void checkForExternalChange(filePath);
      }, WATCH_SETTLE_MS)
    );
  }
}

function setWatchedFiles(paths: string[]): void {
  const wanted = new Set(paths);

  for (const [dir, entry] of dirWatchers) {
    for (const filePath of entry.files) {
      if (wanted.has(filePath)) continue;
      entry.files.delete(filePath);
      knownContent.delete(filePath);
    }
    if (entry.files.size === 0) {
      entry.watcher.close();
      dirWatchers.delete(dir);
    }
  }

  for (const filePath of wanted) {
    const dir = path.dirname(filePath);
    let entry = dirWatchers.get(dir);
    if (!entry) {
      try {
        const watcher = watch(dir, (_event, fileName) => onDirEvent(dir, fileName));
        watcher.on('error', () => {
          watcher.close();
          dirWatchers.delete(dir);
        });
        entry = { watcher, files: new Set() };
        dirWatchers.set(dir, entry);
      } catch {
        continue; // directory gone or unreadable; nothing to watch
      }
    }
    if (entry.files.has(filePath)) continue;
    entry.files.add(filePath);
    if (!knownContent.has(filePath)) {
      void fs
        .readFile(filePath, 'utf8')
        .then((content) => {
          if (!knownContent.has(filePath)) knownContent.set(filePath, content);
        })
        .catch(() => undefined);
    }
  }
}

async function writeKnown(filePath: string, content: string): Promise<void> {
  const previous = knownContent.get(filePath);
  knownContent.set(filePath, content);
  selfWriting.add(filePath);
  try {
    await fs.writeFile(filePath, content, 'utf8');
  } catch (err) {
    if (previous === undefined) knownContent.delete(filePath);
    else knownContent.set(filePath, previous);
    throw err;
  } finally {
    selfWriting.delete(filePath);
  }
}

async function readKnown(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf8');
  knownContent.set(filePath, content);
  return content;
}

// Ask the renderer to write any pending autosaves before the window goes away.
function flushRenderer(win: BrowserWindow, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      ipcMain.removeListener(IPC.appFlushDone, done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    ipcMain.once(IPC.appFlushDone, done);
    win.webContents.send(IPC.appFlushRequest);
  });
}

function parseFileArg(argv: string[]): string | null {
  const args = argv.slice(isDev ? 2 : 1);
  for (const arg of args) {
    if (arg.startsWith('--')) continue;
    if (/\.(md|markdown)$/i.test(arg)) {
      try {
        const resolved = path.resolve(arg);
        return resolved;
      } catch {
        continue;
      }
    }
  }
  return null;
}

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

async function ensureUserThemesDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'themes');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function resolveIconPath(): string | null {
  const candidates = isDev
    ? [path.join(app.getAppPath(), 'build', 'icon.png')]
    : [
        path.join(process.resourcesPath, 'icon.png'),
        path.join(app.getAppPath(), 'build', 'icon.png')
      ];
  for (const c of candidates) {
    try {
      if (require('node:fs').existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

async function createWindow(): Promise<BrowserWindow> {
  const settings = await loadSettings();
  const bounds = settings.windowBounds;

  const iconPath = resolveIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  const win = new BrowserWindow({
    width: bounds?.width ?? 1200,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: '#111111',
    icon,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#cccccc',
      height: 44
    },
    title: 'Markwright',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.on('ready-to-show', () => win.show());

  let readyToClose = false;
  win.on('close', (e) => {
    if (readyToClose) return;
    e.preventDefault();
    const b = win.getBounds();
    void (async () => {
      await Promise.all([
        flushRenderer(win),
        loadSettings().then((current) => saveSettings({ ...current, windowBounds: b }))
      ]).catch(() => undefined);
      readyToClose = true;
      win.close();
    })();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function registerIpc(): void {
  ipcMain.handle(IPC.fileOpenDialog, async (): Promise<LoadedFile | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await readKnown(filePath);
    return { path: filePath, content };
  });

  ipcMain.handle(IPC.fileLoadByPath, async (_e, filePath: string): Promise<LoadedFile | null> => {
    try {
      const content = await readKnown(filePath);
      return { path: filePath, content };
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.fileSave, async (_e, payload: { path: string; content: string }): Promise<SaveResult> => {
    const known = knownContent.get(payload.path);
    if (known !== undefined) {
      const onDisk = await fs.readFile(payload.path, 'utf8').catch(() => null);
      if (onDisk !== null && onDisk !== known) {
        // Changed underneath us and the watcher hasn't reported it yet. Hand the
        // new content to the renderer instead of clobbering someone else's edit.
        knownContent.set(payload.path, onDisk);
        mainWindow?.webContents.send(IPC.fileChangedOnDisk, { path: payload.path, content: onDisk });
        return { ok: false, conflict: true };
      }
    }
    await writeKnown(payload.path, payload.content);
    return { ok: true };
  });

  ipcMain.handle(IPC.fileSetWatched, (_e, paths: string[]) => {
    setWatchedFiles(paths);
  });

  ipcMain.handle(IPC.fileSaveAsDialog, async (_e, content: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: 'untitled.md'
    });
    if (result.canceled || !result.filePath) return null;
    await writeKnown(result.filePath, content);
    return result.filePath;
  });

  ipcMain.handle(IPC.fileGetInitial, async (): Promise<LoadedFile | null> => {
    if (!pendingFilePath) return null;
    try {
      const content = await readKnown(pendingFilePath);
      const result = { path: pendingFilePath, content };
      pendingFilePath = null;
      return result;
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.themesList, async (): Promise<ThemeManifest[]> => {
    const userDir = await ensureUserThemesDir();
    return listAllThemes(userDir);
  });

  ipcMain.handle(IPC.themesLoadCss, async (_e, themeId: string): Promise<string | null> => {
    const userDir = await ensureUserThemesDir();
    return readThemeCss(themeId, userDir);
  });

  ipcMain.handle(IPC.settingsGet, async () => loadSettings());
  ipcMain.handle(IPC.settingsSet, async (_e, partial: Partial<Settings>) => {
    const current = await loadSettings();
    const next = { ...current, ...partial };
    await saveSettings(next);
    return next;
  });

  ipcMain.handle(IPC.windowSetTitle, (_e, title: string) => {
    mainWindow?.setTitle(title);
  });

  ipcMain.handle(IPC.updateInstall, () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle(IPC.appGetInfo, async () => {
    let buildDate: string | null = null;
    try {
      const stats = await fs.stat(app.getPath('exe'));
      buildDate = stats.mtime.toISOString();
    } catch {
      // best-effort
    }
    return {
      name: 'Markwright',
      version: app.getVersion(),
      description: 'A themed Electron markdown viewer/editor with live WYSIWYG and 20 fully-designed visual themes.',
      homepageUrl: 'https://github.com/matthew-mask/Markwright',
      releasesUrl: 'https://github.com/matthew-mask/Markwright/releases',
      issuesUrl: 'https://github.com/matthew-mask/Markwright/issues',
      buildDate
    };
  });

  ipcMain.handle(IPC.appOpenExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
  });

  ipcMain.handle(IPC.dialogConfirmCloseTab, async (_e, fileName: string) => {
    if (!mainWindow) return 'cancel';
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Save changes to ${fileName}?`,
      detail: "Your changes will be lost if you don't save them."
    });
    return (['save', 'discard', 'cancel'] as const)[result.response] ?? 'cancel';
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', async (_e, argv) => {
    const filePath = parseFileArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (filePath) {
        mainWindow.webContents.send('file:openExternal', filePath);
      }
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    pendingFilePath = parseFileArg(process.argv);
    registerIpc();
    mainWindow = await createWindow();
    await ensureUserThemesDir();

    // Auto-update check (no-op in dev / unpackaged builds)
    if (!isDev) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('update:downloaded', {
          version: info.version,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
        });
      });

      autoUpdater.on('error', (err) => {
        console.warn('Auto-updater error:', err?.message ?? err);
      });

      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('Auto-update check failed:', err?.message ?? err);
      });
    }

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('file:openExternal', filePath);
    } else {
      pendingFilePath = filePath;
    }
  });
}
