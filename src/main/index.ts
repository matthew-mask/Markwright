import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { IPC, DEFAULT_SETTINGS, type Settings, type ThemeManifest, type LoadedFile } from '../shared/ipc';
import { listAllThemes, readThemeCss } from './themes';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

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

  win.on('close', async () => {
    const current = await loadSettings();
    const b = win.getBounds();
    await saveSettings({ ...current, windowBounds: b });
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
    const content = await fs.readFile(filePath, 'utf8');
    return { path: filePath, content };
  });

  ipcMain.handle(IPC.fileLoadByPath, async (_e, filePath: string): Promise<LoadedFile | null> => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return { path: filePath, content };
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.fileSave, async (_e, payload: { path: string; content: string }) => {
    await fs.writeFile(payload.path, payload.content, 'utf8');
    return { ok: true };
  });

  ipcMain.handle(IPC.fileSaveAsDialog, async (_e, content: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: 'untitled.md'
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });

  ipcMain.handle(IPC.fileGetInitial, async (): Promise<LoadedFile | null> => {
    if (!pendingFilePath) return null;
    try {
      const content = await fs.readFile(pendingFilePath, 'utf8');
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
