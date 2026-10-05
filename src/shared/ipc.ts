export type ThemeManifest = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  cssPath?: string;
};

export type LoadedFile = {
  path: string | null;
  content: string;
};

export const IPC = {
  // file ops
  fileOpenDialog: 'file:openDialog',
  fileSave: 'file:save',
  fileSaveAsDialog: 'file:saveAsDialog',
  fileGetInitial: 'file:getInitial',
  fileLoadByPath: 'file:loadByPath',
  fileSetWatched: 'file:setWatched',
  fileChangedOnDisk: 'file:changedOnDisk',

  // themes
  themesList: 'themes:list',
  themesLoadCss: 'themes:loadCss',

  // settings
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',

  // window
  windowSetTitle: 'window:setTitle',

  // updates
  updateInstall: 'update:install',

  // app info
  appGetInfo: 'app:getInfo',
  appOpenExternal: 'app:openExternal',
  appFlushRequest: 'app:flushRequest',
  appFlushDone: 'app:flushDone',

  // dialogs
  dialogConfirmCloseTab: 'dialog:confirmCloseTab'
} as const;

export type SaveResult = { ok: true } | { ok: false; conflict: true };

export type DiskChange = {
  path: string;
  content: string;
};

export type CloseTabChoice = 'save' | 'discard' | 'cancel';

export type UpdateInfo = {
  version: string;
  releaseNotes?: string;
};

export type AppInfo = {
  name: string;
  version: string;
  description: string;
  homepageUrl: string;
  releasesUrl: string;
  issuesUrl: string;
  buildDate: string | null;
};

export type Settings = {
  themeId: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
};

export const DEFAULT_SETTINGS: Settings = {
  themeId: 'minimalist'
};
