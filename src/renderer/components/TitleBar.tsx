export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Props = {
  fileName: string;
  // null for a fresh Untitled doc that hasn't been touched.
  saveStatus: SaveStatus | null;
  onOpen: () => void;
  onSave: () => void;
  onTogglePicker: () => void;
  onAbout: () => void;
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Not saved',
  error: 'Save failed'
};

export function TitleBar({ fileName, saveStatus, onOpen, onSave, onTogglePicker, onAbout }: Props): JSX.Element {
  return (
    <header className="mw-titlebar">
      <div className="mw-titlebar-drag" />
      <div className="mw-titlebar-content">
        <div className="mw-titlebar-left">
          <span className="mw-brand">Markwright</span>
          <span className="mw-sep">·</span>
          <span className="mw-filename">
            {saveStatus === 'unsaved' && <span className="mw-dirty-dot" aria-hidden="true">●</span>}
            {fileName}
          </span>
          {saveStatus === 'unsaved' || saveStatus === 'error' ? (
            // Only actionable states are clickable: pick a location, or retry.
            <button
              className={`mw-btn mw-save-status mw-save-status-${saveStatus}`}
              onClick={onSave}
              title={saveStatus === 'unsaved' ? 'Choose where to save (Ctrl+S)' : 'Retry save (Ctrl+S)'}
              type="button"
            >
              {STATUS_LABEL[saveStatus]}
            </button>
          ) : (
            saveStatus && (
              <span className={`mw-save-status mw-save-status-${saveStatus}`} aria-live="polite">
                {STATUS_LABEL[saveStatus]}
              </span>
            )
          )}
        </div>
        <div className="mw-titlebar-right">
          <button
            className="mw-btn mw-btn-icon"
            onClick={onAbout}
            title="About Markwright"
            aria-label="About Markwright"
          >
            <span aria-hidden="true">i</span>
          </button>
          <button className="mw-btn" onClick={onOpen} title="Open (Ctrl+O)">Open</button>
          <button className="mw-btn mw-btn-accent" onClick={onTogglePicker} title="Themes (Ctrl+Shift+P)">Themes</button>
        </div>
      </div>
    </header>
  );
}
