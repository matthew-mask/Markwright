import type { ContentWidth } from '../../shared/ipc';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Props = {
  fileName: string;
  // null for a fresh Untitled doc that hasn't been touched.
  saveStatus: SaveStatus | null;
  sidebarCollapsed: boolean;
  contentWidth: ContentWidth;
  onOpen: () => void;
  onSave: () => void;
  onTogglePicker: () => void;
  onToggleSidebar: () => void;
  onToggleContentWidth: () => void;
  onAbout: () => void;
};

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const;

const SidebarIcon = (): JSX.Element => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
);

// Arrows out to the edges: go full width.
const ExpandIcon = (): JSX.Element => (
  <svg {...ICON_PROPS}>
    <path d="M3 5v14M21 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3" />
  </svg>
);

// Arrows in toward a column: go back to readable width.
const ShrinkIcon = (): JSX.Element => (
  <svg {...ICON_PROPS}>
    <path d="M12 5v14M3 12h6M6 9l3 3-3 3M21 12h-6M18 9l-3 3 3 3" />
  </svg>
);

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Not saved',
  error: 'Save failed'
};

export function TitleBar({
  fileName,
  saveStatus,
  sidebarCollapsed,
  contentWidth,
  onOpen,
  onSave,
  onTogglePicker,
  onToggleSidebar,
  onToggleContentWidth,
  onAbout
}: Props): JSX.Element {
  const sidebarLabel = sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar';
  const widthLabel = contentWidth === 'full' ? 'Readable width' : 'Full width';
  return (
    <header className="mw-titlebar">
      <div className="mw-titlebar-drag" />
      <div className="mw-titlebar-content">
        <div className="mw-titlebar-left">
          <button
            className="mw-btn mw-btn-icon"
            onClick={onToggleSidebar}
            title={`${sidebarLabel} (Ctrl+\\)`}
            aria-label={sidebarLabel}
            aria-pressed={!sidebarCollapsed}
            type="button"
          >
            <SidebarIcon />
          </button>
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
            onClick={onToggleContentWidth}
            title={widthLabel}
            aria-label={widthLabel}
            type="button"
          >
            {contentWidth === 'full' ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
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
