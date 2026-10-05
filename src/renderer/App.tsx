import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThemeManifest, UpdateInfo } from '../shared/ipc';
import { AboutDialog } from './components/AboutDialog';
import { Editor, type ExternalContent } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { TitleBar, type SaveStatus } from './components/TitleBar';
import { ThemePicker } from './components/ThemePicker';
import { UpdateBanner } from './components/UpdateBanner';
import { useTheme } from './hooks/useTheme';

type Tab = {
  id: string;
  filePath: string | null;
  // What's on disk as far as we know; the baseline `dirty` compares against.
  initialContent: string;
  liveContent: string;
  dirty: boolean;
  saving: boolean;
  saveError: boolean;
  // Set when the file changes outside the app; the Editor swaps it in.
  external: ExternalContent | null;
  title: string;
};

// Quiet period after the last keystroke before a file-backed doc is written.
const AUTOSAVE_DELAY_MS = 400;

const DEFAULT_DOC = `# Welcome to Markwright

Start typing — markdown becomes styled inline as you write.

- **Bold**, *italic*, ~~strike~~, and \`code\`.
- [Links](https://example.com) open in your browser.
- Try a > blockquote, a code block, or a task list.

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}!\`;
\`\`\`

| Theme        | Vibe                       |
|--------------|----------------------------|
| Blueprint    | Drafting room              |
| Glassmorphism| Frosted future             |
| Newspaper    | Yesterday's headlines      |

Use the picker in the corner to swap themes.
`;

let tabIdCounter = 0;
const newTabId = (): string => `tab-${++tabIdCounter}`;

const titleForPath = (path: string | null): string =>
  path ? path.split(/[\\/]/).pop() ?? 'Untitled' : 'Untitled';

const makeUntitledTab = (): Tab => ({
  id: newTabId(),
  filePath: null,
  initialContent: DEFAULT_DOC,
  liveContent: DEFAULT_DOC,
  dirty: false,
  saving: false,
  saveError: false,
  external: null,
  title: 'Untitled'
});

const makeFileTab = (filePath: string, content: string): Tab => ({
  id: newTabId(),
  filePath,
  initialContent: content,
  liveContent: content,
  dirty: false,
  saving: false,
  saveError: false,
  external: null,
  title: titleForPath(filePath)
});

const saveStatusFor = (tab: Tab): SaveStatus | null => {
  if (!tab.filePath) return tab.dirty ? 'unsaved' : null;
  if (tab.saveError) return 'error';
  return tab.dirty || tab.saving ? 'saving' : 'saved';
};

// Autosave makes a pending write invisible; only flag docs that need the user.
const needsAttention = (tab: Tab): boolean => {
  const status = saveStatusFor(tab);
  return status === 'unsaved' || status === 'error';
};

export default function App(): JSX.Element {
  const [themes, setThemes] = useState<ThemeManifest[]>([]);
  const [tabs, setTabs] = useState<Tab[]>(() => [makeUntitledTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const { themeId, setThemeId } = useTheme();

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeTabId);
  activeIdRef.current = activeTabId;
  const mainRef = useRef<HTMLElement>(null);

  // Autosave bookkeeping lives in refs, not tab state, so a disk change can
  // cancel a pending write synchronously instead of waiting for a render.
  const pendingWrites = useRef(new Map<string, string>());
  const saveTimers = useRef(new Map<string, number>());
  const saveChains = useRef(new Map<string, Promise<boolean>>());

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // ---- file → tab routing ---------------------------------------------------

  const openOrFocusFileTab = useCallback((file: { path: string; content: string }) => {
    const existing = tabsRef.current.find((t) => t.filePath === file.path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    setTabs((prev) => {
      // If the only tab is a clean Untitled, replace it instead of stacking.
      if (prev.length === 1 && !prev[0].dirty && !prev[0].filePath) {
        const t = makeFileTab(file.path, file.content);
        setActiveTabId(t.id);
        return [t];
      }
      const t = makeFileTab(file.path, file.content);
      setActiveTabId(t.id);
      return [...prev, t];
    });
  }, []);

  // ---- effects --------------------------------------------------------------

  useEffect(() => {
    void window.markwright.listThemes().then(setThemes);
    window.markwright.onUpdateDownloaded((info) => setPendingUpdate(info));
  }, []);

  useEffect(() => {
    void window.markwright.getInitialFile().then((file) => {
      if (file?.path) openOrFocusFileTab({ path: file.path, content: file.content });
    });
    window.markwright.onExternalFileOpen((filePath) => {
      void window.markwright.loadByPath(filePath).then((file) => {
        if (file?.path) openOrFocusFileTab({ path: file.path, content: file.content });
      });
    });
  }, [openOrFocusFileTab]);

  // Window title reflects active tab.
  const activeNeedsAttention = needsAttention(activeTab);
  useEffect(() => {
    const title = `${activeNeedsAttention ? '● ' : ''}${activeTab.title} — Markwright`;
    void window.markwright.setWindowTitle(title);
  }, [activeTab.title, activeNeedsAttention]);

  // Keep main's watch list in sync with the files open in tabs.
  const watchedKey = tabs.flatMap((t) => (t.filePath ? [t.filePath] : [])).join('\n');
  useEffect(() => {
    void window.markwright.setWatchedFiles(watchedKey ? watchedKey.split('\n') : []);
  }, [watchedKey]);

  // Reset scroll to top when active tab changes (or when the doc switches).
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeTabId]);

  // ---- autosave -------------------------------------------------------------

  const cancelAutosave = useCallback((tabId: string) => {
    clearTimeout(saveTimers.current.get(tabId));
    saveTimers.current.delete(tabId);
    pendingWrites.current.delete(tabId);
  }, []);

  // Write the tab's pending edit, if any. Resolves false only if the write failed.
  const writeTab = useCallback((tabId: string): Promise<boolean> => {
    clearTimeout(saveTimers.current.get(tabId));
    saveTimers.current.delete(tabId);
    // Chain per tab so writes land in the order they were made.
    const run = (saveChains.current.get(tabId) ?? Promise.resolve(true)).then(async () => {
      const filePath = tabsRef.current.find((t) => t.id === tabId)?.filePath;
      const content = pendingWrites.current.get(tabId);
      if (!filePath || content === undefined) return true;
      pendingWrites.current.delete(tabId);
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, saving: true } : t)));
      try {
        const result = await window.markwright.save(filePath, content);
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tabId) return t;
            // On conflict the disk version is already on its way in via onFileChangedOnDisk.
            if (!result.ok) return { ...t, saving: false };
            return { ...t, saving: false, saveError: false, initialContent: content, dirty: t.liveContent !== content };
          })
        );
        return true;
      } catch {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, saving: false, saveError: true } : t)));
        return false;
      }
    });
    saveChains.current.set(tabId, run);
    return run;
  }, []);

  // Write now rather than after the quiet period (Ctrl+S, closing, quitting).
  // Also retries a failed save, whose edit is no longer pending.
  const flushTab = useCallback(
    (tabId: string): Promise<boolean> => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab?.filePath && tab.dirty && !pendingWrites.current.has(tabId)) {
        pendingWrites.current.set(tabId, tab.liveContent);
      }
      return writeTab(tabId);
    },
    [writeTab]
  );

  // The file changed outside the app (an AI agent, another editor). Disk wins:
  // drop any edit we hadn't written yet and show what's there now.
  useEffect(
    () =>
      window.markwright.onFileChangedOnDisk(({ path, content }) => {
        const tab = tabsRef.current.find((t) => t.filePath === path);
        if (!tab) return;
        cancelAutosave(tab.id);
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tab.id) return t;
            if (content === t.liveContent) return { ...t, initialContent: content, dirty: false, saveError: false };
            return { ...t, saveError: false, external: { markdown: content, rev: (t.external?.rev ?? 0) + 1 } };
          })
        );
      }),
    [cancelAutosave]
  );

  useEffect(
    () =>
      window.markwright.onFlushRequest(async () => {
        await Promise.all(tabsRef.current.map((t) => flushTab(t.id)));
      }),
    [flushTab]
  );

  // ---- editor change → tab state -------------------------------------------

  const handleTabChange = useCallback(
    (tabId: string, markdown: string, isInitial: boolean) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          if (isInitial) {
            return { ...t, initialContent: markdown, liveContent: markdown, dirty: false };
          }
          return { ...t, liveContent: markdown, dirty: markdown !== t.initialContent };
        })
      );
      if (isInitial) return;
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab?.filePath) return;
      if (!pendingWrites.current.has(tabId) && markdown === tab.initialContent) return;
      pendingWrites.current.set(tabId, markdown);
      clearTimeout(saveTimers.current.get(tabId));
      saveTimers.current.set(tabId, window.setTimeout(() => void writeTab(tabId), AUTOSAVE_DELAY_MS));
    },
    [writeTab]
  );

  // ---- file commands --------------------------------------------------------

  const openFile = useCallback(async () => {
    const file = await window.markwright.openFileDialog();
    if (file?.path) openOrFocusFileTab({ path: file.path, content: file.content });
  }, [openOrFocusFileTab]);

  const saveAs = useCallback(
    async (tabId: string): Promise<boolean> => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return false;
      const newPath = await window.markwright.saveAsDialog(tab.liveContent);
      if (!newPath) return false;
      cancelAutosave(tabId);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                filePath: newPath,
                initialContent: t.liveContent,
                dirty: false,
                saveError: false,
                title: titleForPath(newPath)
              }
            : t
        )
      );
      return true;
    },
    [cancelAutosave]
  );

  // Ctrl+S: file-backed docs autosave anyway, so this just writes immediately.
  // Untitled docs have nowhere to go yet, so it asks for a location.
  const saveActive = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeIdRef.current);
    if (!tab) return;
    if (tab.filePath) await flushTab(tab.id);
    else await saveAs(tab.id);
  }, [flushTab, saveAs]);

  // ---- tab commands ---------------------------------------------------------

  const newTab = useCallback(() => {
    const t = makeUntitledTab();
    setTabs((prev) => [...prev, t]);
    setActiveTabId(t.id);
  }, []);

  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab) return;

      // File-backed docs close without asking once their last edit is on disk.
      // Only never-saved docs, or ones whose save failed, need a decision.
      const needsDecision = tab.filePath ? !(await flushTab(tabId)) : tab.dirty;
      if (needsDecision) {
        const choice = await window.markwright.confirmCloseTab(tab.title);
        if (choice === 'cancel') return;
        if (choice === 'save') {
          const saved = await saveAs(tabId);
          if (!saved) return; // user cancelled the save-as dialog
        }
      }
      cancelAutosave(tabId);
      saveChains.current.delete(tabId);

      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          const fresh = makeUntitledTab();
          setActiveTabId(fresh.id);
          return [fresh];
        }
        if (tabId === activeIdRef.current) {
          const newActive = next[Math.min(idx, next.length - 1)];
          setActiveTabId(newActive.id);
        }
        return next;
      });
    },
    [flushTab, saveAs, cancelAutosave]
  );

  const cycleTab = useCallback((dir: 1 | -1) => {
    const list = tabsRef.current;
    if (list.length < 2) return;
    const idx = list.findIndex((t) => t.id === activeIdRef.current);
    if (idx === -1) return;
    const next = list[(idx + dir + list.length) % list.length];
    setActiveTabId(next.id);
  }, []);

  // ---- drag-and-drop --------------------------------------------------------

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      e.preventDefault();
      // Open every dropped .md file as a new tab; switch to the last one.
      for (const file of Array.from(files)) {
        if (!/\.(md|markdown)$/i.test(file.name)) continue;
        const filePath = window.markwright.getDroppedFilePath(file);
        if (!filePath) continue;
        const loaded = await window.markwright.loadByPath(filePath);
        if (loaded?.path) openOrFocusFileTab({ path: loaded.path, content: loaded.content });
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [openOrFocusFileTab]);

  // ---- keyboard shortcuts ---------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        void saveActive();
      } else if (e.key === 'S' || (e.key === 's' && e.shiftKey)) {
        e.preventDefault();
        void saveAs(activeIdRef.current);
      } else if (e.key === 'o') {
        e.preventDefault();
        void openFile();
      } else if (e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        newTab();
      } else if (e.key === 'w' && !e.shiftKey) {
        e.preventDefault();
        void closeTab(activeIdRef.current);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
      } else if (e.key === 'p' && e.shiftKey) {
        e.preventDefault();
        setShowThemePicker((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveActive, saveAs, openFile, newTab, closeTab, cycleTab]);

  // ---- render ---------------------------------------------------------------

  return (
    <div className="mw-app">
      <div className="mw-bg-decoration" aria-hidden="true" />
      <TitleBar
        fileName={activeTab.title}
        saveStatus={saveStatusFor(activeTab)}
        onOpen={openFile}
        onSave={() => void saveActive()}
        onTogglePicker={() => setShowThemePicker((s) => !s)}
        onAbout={() => setShowAbout(true)}
      />
      {pendingUpdate && (
        <UpdateBanner
          version={pendingUpdate.version}
          onInstall={() => window.markwright.installUpdate()}
          onDismiss={() => setPendingUpdate(null)}
        />
      )}
      <div className="mw-body">
        <Sidebar
          tabs={tabs.map((t) => ({ id: t.id, title: t.title, dirty: needsAttention(t) }))}
          activeTabId={activeTabId}
          onSwitch={setActiveTabId}
          onClose={(id) => void closeTab(id)}
          onNew={newTab}
        />
        <main className="mw-main" ref={mainRef}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="mw-editor-wrap"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              <Editor
                initialMarkdown={tab.initialContent}
                external={tab.external}
                onChange={(md, isInitial) => handleTabChange(tab.id, md, isInitial)}
              />
            </div>
          ))}
        </main>
      </div>
      {showThemePicker && (
        <ThemePicker
          themes={themes}
          activeId={themeId}
          onPick={(id) => {
            setThemeId(id);
            setShowThemePicker(false);
          }}
          onClose={() => setShowThemePicker(false)}
        />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
