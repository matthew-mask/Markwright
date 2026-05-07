import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeManifest, UpdateInfo } from '../shared/ipc';
import { Editor } from './components/Editor';
import { TitleBar } from './components/TitleBar';
import { ThemePicker } from './components/ThemePicker';
import { UpdateBanner } from './components/UpdateBanner';
import { useTheme } from './hooks/useTheme';

type DocState = {
  filePath: string | null;
  initialContent: string;
  dirty: boolean;
  liveContent: string;
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

export default function App(): JSX.Element {
  const [themes, setThemes] = useState<ThemeManifest[]>([]);
  const [doc, setDoc] = useState<DocState>({
    filePath: null,
    initialContent: DEFAULT_DOC,
    dirty: false,
    liveContent: DEFAULT_DOC
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const { themeId, setThemeId } = useTheme();
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    void window.markwright.listThemes().then(setThemes);
    window.markwright.onUpdateDownloaded((info) => setPendingUpdate(info));
  }, []);

  useEffect(() => {
    void window.markwright.getInitialFile().then((file) => {
      if (file) {
        setDoc({ filePath: file.path, initialContent: file.content, dirty: false, liveContent: file.content });
      }
    });
    window.markwright.onExternalFileOpen((filePath) => {
      void window.markwright.loadByPath(filePath).then((file) => {
        if (file) {
          setDoc({ filePath: file.path, initialContent: file.content, dirty: false, liveContent: file.content });
        }
      });
    });
  }, []);

  useEffect(() => {
    const fileName = doc.filePath ? doc.filePath.split(/[\\/]/).pop() : 'Untitled';
    const title = `${doc.dirty ? '● ' : ''}${fileName} — Markwright`;
    void window.markwright.setWindowTitle(title);
  }, [doc.filePath, doc.dirty]);

  const handleChange = useCallback((markdown: string, isInitial: boolean) => {
    if (isInitial) {
      setDoc((d) => ({ ...d, initialContent: markdown, liveContent: markdown, dirty: false }));
    } else {
      setDoc((d) => ({ ...d, liveContent: markdown, dirty: markdown !== d.initialContent }));
    }
  }, []);

  const openFile = useCallback(async () => {
    const file = await window.markwright.openFileDialog();
    if (file) {
      setDoc({ filePath: file.path, initialContent: file.content, dirty: false, liveContent: file.content });
    }
  }, []);

  const saveFile = useCallback(async () => {
    const current = docRef.current;
    if (current.filePath) {
      await window.markwright.save(current.filePath, current.liveContent);
      setDoc((d) => ({ ...d, initialContent: d.liveContent, dirty: false }));
    } else {
      const newPath = await window.markwright.saveAsDialog(current.liveContent);
      if (newPath) {
        setDoc((d) => ({ ...d, filePath: newPath, initialContent: d.liveContent, dirty: false }));
      }
    }
  }, []);

  const saveAs = useCallback(async () => {
    const current = docRef.current;
    const newPath = await window.markwright.saveAsDialog(current.liveContent);
    if (newPath) {
      setDoc((d) => ({ ...d, filePath: newPath, initialContent: d.liveContent, dirty: false }));
    }
  }, []);

  // Drag-and-drop a .md file onto the window to open it.
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
      const file = files[0];
      if (!/\.(md|markdown)$/i.test(file.name)) return;
      const filePath = window.markwright.getDroppedFilePath(file);
      if (!filePath) return;
      const loaded = await window.markwright.loadByPath(filePath);
      if (loaded) {
        setDoc({
          filePath: loaded.path,
          initialContent: loaded.content,
          dirty: false,
          liveContent: loaded.content
        });
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        void saveFile();
      } else if (e.key === 'S' || (e.key === 's' && e.shiftKey)) {
        e.preventDefault();
        void saveAs();
      } else if (e.key === 'o') {
        e.preventDefault();
        void openFile();
      } else if (e.key === 'p' && e.shiftKey) {
        e.preventDefault();
        setShowThemePicker((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveFile, saveAs, openFile]);

  const fileName = useMemo(() => (doc.filePath ? doc.filePath.split(/[\\/]/).pop() : 'Untitled'), [doc.filePath]);

  return (
    <div className="mw-app">
      <div className="mw-bg-decoration" aria-hidden="true" />
      <TitleBar
        fileName={fileName ?? 'Untitled'}
        dirty={doc.dirty}
        onOpen={openFile}
        onSave={saveFile}
        onTogglePicker={() => setShowThemePicker((s) => !s)}
      />
      {pendingUpdate && (
        <UpdateBanner
          version={pendingUpdate.version}
          onInstall={() => window.markwright.installUpdate()}
          onDismiss={() => setPendingUpdate(null)}
        />
      )}
      <main className="mw-main">
        <Editor key={doc.filePath ?? 'new'} initialMarkdown={doc.initialContent} onChange={handleChange} />
      </main>
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
    </div>
  );
}
