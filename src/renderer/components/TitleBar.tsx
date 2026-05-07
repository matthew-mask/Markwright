type Props = {
  fileName: string;
  dirty: boolean;
  onOpen: () => void;
  onSave: () => void;
  onTogglePicker: () => void;
};

export function TitleBar({ fileName, dirty, onOpen, onSave, onTogglePicker }: Props): JSX.Element {
  return (
    <header className="mw-titlebar">
      <div className="mw-titlebar-drag" />
      <div className="mw-titlebar-content">
        <div className="mw-titlebar-left">
          <span className="mw-brand">Markwright</span>
          <span className="mw-sep">·</span>
          <span className="mw-filename">
            {dirty && <span className="mw-dirty-dot" aria-hidden="true">●</span>}
            {fileName}
          </span>
        </div>
        <div className="mw-titlebar-right">
          <button className="mw-btn" onClick={onOpen} title="Open (Ctrl+O)">Open</button>
          <button className="mw-btn" onClick={onSave} title="Save (Ctrl+S)">Save</button>
          <button className="mw-btn mw-btn-accent" onClick={onTogglePicker} title="Themes (Ctrl+Shift+P)">Themes</button>
        </div>
      </div>
    </header>
  );
}
