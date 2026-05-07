import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/ipc';

type Props = {
  onClose: () => void;
};

export function AboutDialog({ onClose }: Props): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void window.markwright.getAppInfo().then(setInfo);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const formatDate = (iso: string | null): string => {
    if (!iso) return 'unknown';
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const openLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    void window.markwright.openExternal(url);
  };

  return (
    <div className="mw-modal-backdrop" onClick={onClose}>
      <div className="mw-modal mw-about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mw-modal-header">
          <h2>About Markwright</h2>
          <button className="mw-btn" onClick={onClose}>Close</button>
        </div>

        {info && (
          <div className="mw-about-body">
            <div className="mw-about-hero">
              <div className="mw-about-version">
                <div className="mw-about-name">{info.name}</div>
                <div className="mw-about-version-line">v{info.version}</div>
                <div className="mw-about-build">Built on {formatDate(info.buildDate)}</div>
              </div>
            </div>

            <p className="mw-about-description">{info.description}</p>

            <dl className="mw-about-links">
              <dt>Source</dt>
              <dd>
                <a href={info.homepageUrl} onClick={(e) => openLink(e, info.homepageUrl)}>
                  {info.homepageUrl.replace(/^https?:\/\//, '')}
                </a>
              </dd>
              <dt>Releases</dt>
              <dd>
                <a href={info.releasesUrl} onClick={(e) => openLink(e, info.releasesUrl)}>
                  {info.releasesUrl.replace(/^https?:\/\//, '')}
                </a>
              </dd>
              <dt>Report an issue</dt>
              <dd>
                <a href={info.issuesUrl} onClick={(e) => openLink(e, info.issuesUrl)}>
                  {info.issuesUrl.replace(/^https?:\/\//, '')}
                </a>
              </dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
