import { useCallback, useEffect, useRef, useState } from 'react';
import type { ThemeManifest, UpdateInfo } from '../shared/ipc';
import { AboutDialog } from './components/AboutDialog';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { ThemePicker } from './components/ThemePicker';
import { UpdateBanner } from './components/UpdateBanner';
import { useTheme } from './hooks/useTheme';

type Tab = {
  id: string;
  filePath: string | null;
  initialContent: string;
  liveContent: string;
  dirty: boolean;
  title: string;
};

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
  title: 'Untitled'
});

const makeFileTab = (filePath: string, content: string): Tab => ({
  id: newTabId(),
  filePath,
  initialContent: content,
  liveContent: content,
  dirty: false,
  title: titleForPath(filePath)
});

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
  useEffect(() => {
    const title = `${activeTab.dirty ? '● ' : ''}${activeTab.title} — Markwright`;
    void window.markwright.setWindowTitle(title);
  }, [activeTab.title, activeTab.dirty]);

  // Reset scroll to top when active tab changes (or when the doc switches).
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeTabId]);

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
    },
    []
  );

  // ---- file commands --------------------------------------------------------

  const openFile = useCallback(async () => {
    const file = await window.markwright.openFileDialog();
    if (file?.path) openOrFocusFileTab({ path: file.path, content: file.content });
  }, [openOrFocusFileTab]);

  const saveTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab) return false;
    if (tab.filePath) {
      await window.markwright.save(tab.filePath, tab.liveContent);
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, initialContent: t.liveContent, dirty: false } : t))
      );
      return true;
    }
    const newPath = await window.markwright.saveAsDialog(tab.liveContent);
    if (!newPath) return false;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, filePath: newPath, initialContent: t.liveContent, dirty: false, title: titleForPath(newPath) }
          : t
      )
    );
    return true;
  }, []);

  const saveActive = useCallback(() => saveTab(activeIdRef.current), [saveTab]);

  const saveAs = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeIdRef.current);
    if (!tab) return;
    const newPath = await window.markwright.saveAsDialog(tab.liveContent);
    if (!newPath) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tab.id
          ? { ...t, filePath: newPath, initialContent: t.liveContent, dirty: false, title: titleForPath(newPath) }
          : t
      )
    );
  }, []);

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

      if (tab.dirty) {
        const choice = await window.markwright.confirmCloseTab(tab.title);
        if (choice === 'cancel') return;
        if (choice === 'save') {
          const saved = await saveTab(tabId);
          if (!saved) return; // user cancelled the save-as dialog
        }
      }

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
    [saveTab]
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
        void saveAs();
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
        dirty={activeTab.dirty}
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
          tabs={tabs.map((t) => ({ id: t.id, title: t.title, dirty: t.dirty }))}
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
