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

  // themes
  themesList: 'themes:list',
  themesLoadCss: 'themes:loadCss',

  // settings
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',

  // window
  windowSetTitle: 'window:setTitle'
} as const;

export type Settings = {
  themeId: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
};

export const DEFAULT_SETTINGS: Settings = {
  themeId: 'minimalist'
};
