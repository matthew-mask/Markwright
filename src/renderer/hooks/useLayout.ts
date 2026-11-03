import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type ContentWidth } from '../../shared/ipc';

export function useLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(DEFAULT_SETTINGS.sidebarCollapsed);
  const [contentWidth, setContentWidth] = useState<ContentWidth>(DEFAULT_SETTINGS.contentWidth);

  useEffect(() => {
    void window.markwright.getSettings().then((s) => {
      setSidebarCollapsed(s.sidebarCollapsed);
      setContentWidth(s.contentWidth);
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    void window.markwright.setSettings({ sidebarCollapsed: next });
  }, [sidebarCollapsed]);

  const toggleContentWidth = useCallback(() => {
    const next: ContentWidth = contentWidth === 'full' ? 'readable' : 'full';
    setContentWidth(next);
    void window.markwright.setSettings({ contentWidth: next });
  }, [contentWidth]);

  return { sidebarCollapsed, toggleSidebar, contentWidth, toggleContentWidth };
}
