import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ThemeManifest } from '../shared/ipc';

const BUILTIN_THEMES: ThemeManifest[] = [
  { id: 'graph-paper', name: 'Pen & Graph Paper', description: 'Hand-drawn ink on a graph-paper grid.', builtin: true },
  { id: 'blueprint', name: 'Blueprint', description: 'Cyan-on-navy technical drafting.', builtin: true },
  { id: 'glassmorphism', name: 'Glassmorphism', description: 'Frosted translucent panels with soft glow.', builtin: true },
  { id: 'minimalist', name: 'Minimalist', description: 'Generous whitespace and refined type.', builtin: true },
  { id: 'brutalism', name: 'Brutalism', description: 'Raw, blocky, monospaced, no apologies.', builtin: true },
  { id: 'terminal-crt', name: 'Terminal / CRT', description: 'Phosphor green on black with scanlines.', builtin: true },
  { id: 'newspaper', name: 'Newspaper', description: 'Aged newsprint with serif headlines and drop caps.', builtin: true },
  { id: 'cyberpunk-neon', name: 'Cyberpunk Neon', description: 'Magenta and cyan neon over black.', builtin: true },
  { id: 'manuscript', name: 'Manuscript', description: 'Aged parchment, gilt drop caps, fleuron ornaments.', builtin: true },
  { id: 'vaporwave', name: 'Vaporwave', description: 'Pastel sun-grid horizon and chrome script.', builtin: true },
  { id: 'comic-book', name: 'Comic Book', description: 'Halftone dots, inked panels, KAPOW display type.', builtin: true },
  { id: 'zen', name: 'Zen / Sumi-e', description: 'Washi paper, ink wash, vermilion seal accent.', builtin: true },
  { id: 'dark-academia', name: 'Dark Academia', description: 'Candlelit oxblood and brass on charred wood.', builtin: true },
  { id: 'pixel-8bit', name: 'Pixel 8-bit', description: 'Game Boy LCD palette and chunky pixel type.', builtin: true },
  { id: 'steampunk', name: 'Steampunk', description: 'Aged paper, brass cogs, vintage typewriter ink.', builtin: true },
  { id: 'solarpunk', name: 'Solarpunk', description: 'Sun-warm cream, sage, and terracotta botanicals.', builtin: true },
  { id: 'risograph', name: 'Risograph', description: 'Off-register fluorescent print-shop overlay.', builtin: true },
  { id: 'stargazer', name: 'Stargazer', description: 'Quiet night sky with stars and nebula glow.', builtin: true },
  { id: 'polaroid', name: 'Polaroid', description: 'Sepia photo album with white-bordered snapshots.', builtin: true },
  { id: 'mission-control', name: 'Mission Control', description: 'NASA-era ivory and orange on deep space blue.', builtin: true }
];

export async function listAllThemes(userThemesDir: string): Promise<ThemeManifest[]> {
  const userThemes: ThemeManifest[] = [];
  try {
    const entries = await fs.readdir(userThemesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifestPath = path.join(userThemesDir, e.name, 'theme.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const data = JSON.parse(raw) as Partial<ThemeManifest>;
        if (!data.id || !data.name) continue;
        userThemes.push({
          id: `user:${data.id}`,
          name: data.name,
          description: data.description ?? '',
          builtin: false,
          cssPath: path.join(userThemesDir, e.name, 'theme.css')
        });
      } catch {
        // ignore malformed user theme
      }
    }
  } catch {
    // dir missing — caller ensures it
  }
  return [...BUILTIN_THEMES, ...userThemes];
}

export async function readThemeCss(themeId: string, userThemesDir: string): Promise<string | null> {
  if (themeId.startsWith('user:')) {
    const id = themeId.slice('user:'.length);
    const cssPath = path.join(userThemesDir, id, 'theme.css');
    try {
      return await fs.readFile(cssPath, 'utf8');
    } catch {
      return null;
    }
  }
  // built-in CSS lives in the renderer bundle and is imported there;
  // but for safety, check resources too
  return null;
}
