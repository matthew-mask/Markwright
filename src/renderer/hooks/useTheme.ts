import { useEffect, useState } from 'react';

export function useTheme() {
  const [themeId, setThemeIdState] = useState<string>('minimalist');

  useEffect(() => {
    void window.markwright.getSettings().then((s) => {
      setThemeIdState(s.themeId);
      applyTheme(s.themeId);
    });
  }, []);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    applyTheme(id);
    void window.markwright.setSettings({ themeId: id });
  };

  return { themeId, setThemeId };
}

async function applyTheme(themeId: string) {
  document.documentElement.setAttribute('data-theme', themeId);

  const styleId = 'mw-user-theme-style';
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  if (themeId.startsWith('user:')) {
    const css = await window.markwright.loadThemeCss(themeId);
    if (css) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
    }
  }
}
