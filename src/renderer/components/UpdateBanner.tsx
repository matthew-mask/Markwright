type Props = {
  version: string;
  onInstall: () => void;
  onDismiss: () => void;
};

export function UpdateBanner({ version, onInstall, onDismiss }: Props): JSX.Element {
  return (
    <div className="mw-update-banner" role="status">
      <div className="mw-update-banner-content">
        <span className="mw-update-banner-icon" aria-hidden="true">↑</span>
        <span className="mw-update-banner-text">
          <strong>Update ready:</strong> Markwright {version} is downloaded. Restart to apply.
        </span>
      </div>
      <div className="mw-update-banner-actions">
        <button className="mw-btn" onClick={onDismiss}>Later</button>
        <button className="mw-btn mw-btn-accent" onClick={onInstall}>Restart now</button>
      </div>
    </div>
  );
}
