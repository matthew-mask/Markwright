# Markwright

A themed markdown editor for people who want their writing surface to feel like *somewhere*.

- **Live WYSIWYG** — markdown becomes styled inline as you type (Tiptap / ProseMirror).
- **Live documents** — edits autosave as you type, and changes made to the file elsewhere (e.g. by an AI agent) appear in the open tab immediately.
- **Single-file, fast** — open one `.md` file at a time. Built for "open this for me" workflows.
- **Eight built-in themes** that go beyond palette swaps:
  Pen & Graph Paper, Blueprint, Glassmorphism, Minimalist, Brutalism, Terminal/CRT, Newspaper, Cyberpunk Neon.
- **Custom themes** — drop a `theme.json` + `theme.css` folder into your user themes directory and it appears in the picker.

## Dev

```
npm install
npm run dev
```

## Build / install

```
npm run package
```

This produces an NSIS installer in `dist/`. Installing it:
- Registers Markwright as a handler for `.md` and `.markdown` files (right-click → Open with).
- Drops a `mw.cmd` CLI shim next to the exe. To use `mw README.md` from any shell, add the install dir to your PATH (e.g. `setx PATH "%PATH%;%LOCALAPPDATA%\Programs\Markwright"`).

## Custom themes

After first launch, you'll find a `themes/` folder under your user data directory:
- Windows: `%APPDATA%\Markwright\themes\`

Create a subfolder per theme:

```
themes/
  my-theme/
    theme.json
    theme.css
```

`theme.json`:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "description": "What it looks like."
}
```

`theme.css` should target `[data-theme="user:my-theme"]` and override the CSS variables defined in the built-in themes.

## Keyboard

| Shortcut          | Action          |
|-------------------|-----------------|
| Ctrl+O            | Open file       |
| Ctrl+S            | Save now (files autosave; asks for a location if Untitled) |
| Ctrl+Shift+S      | Save As         |
| Ctrl+Shift+P      | Theme picker    |
