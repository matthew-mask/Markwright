import type { ThemeManifest } from '../../shared/ipc';
import { useEffect } from 'react';

type Props = {
  themes: ThemeManifest[];
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
};

export function ThemePicker({ themes, activeId, onPick, onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mw-modal-header">
          <h2>Themes</h2>
          <button className="mw-btn" onClick={onClose}>Close</button>
        </div>
        <div className="mw-theme-grid">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`mw-theme-card ${t.id === activeId ? 'mw-theme-card-active' : ''}`}
              onClick={() => onPick(t.id)}
              data-theme-preview={t.id}
            >
              <div className="mw-theme-preview" data-theme={t.id}>
                <div className="mw-theme-preview-inner">
                  <div className="mw-theme-preview-h1">Aa</div>
                  <div className="mw-theme-preview-line" />
                  <div className="mw-theme-preview-line short" />
                </div>
              </div>
              <div className="mw-theme-meta">
                <div className="mw-theme-name">{t.name}</div>
                <div className="mw-theme-desc">{t.description}</div>
                {!t.builtin && <div className="mw-theme-tag">Custom</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="mw-modal-footer">
          <span className="mw-modal-hint">Drop CSS themes into the user themes folder to add your own.</span>
        </div>
      </div>
    </div>
  );
}
