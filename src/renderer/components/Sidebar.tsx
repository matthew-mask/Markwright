export type SidebarTab = {
  id: string;
  title: string;
  dirty: boolean;
};

type Props = {
  tabs: SidebarTab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

export function Sidebar({ tabs, activeTabId, onSwitch, onClose, onNew }: Props): JSX.Element {
  return (
    <aside className="mw-sidebar" aria-label="Open documents">
      <button
        className="mw-sidebar-new"
        onClick={onNew}
        title="New tab (Ctrl+T)"
        type="button"
      >
        <span className="mw-sidebar-new-icon" aria-hidden="true">+</span>
        <span>New</span>
      </button>
      <div className="mw-tab-list" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`mw-tab ${isActive ? 'mw-tab-active' : ''}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSwitch(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSwitch(tab.id);
                }
              }}
              title={tab.title}
            >
              <span className="mw-tab-name">
                {tab.dirty && <span className="mw-tab-dirty" aria-hidden="true">●</span>}
                <span className="mw-tab-name-text">{tab.title}</span>
              </span>
              <button
                className="mw-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                title="Close tab (Ctrl+W)"
                aria-label={`Close ${tab.title}`}
                type="button"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
