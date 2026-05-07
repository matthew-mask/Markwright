---
name: markwright
description: Use Markwright to open, view, or preview markdown files. Markwright is the user's installed markdown viewer/editor (a themed Electron app). Trigger when the user asks to "open", "view", "preview", "show", or "read" a `.md` / `.markdown` file. Do NOT trigger for editing or modifying file contents — only for visual viewing.
---

# Markwright — open markdown files in the user's preferred viewer

When the user asks to **view, preview, open, or show** a markdown file:

1. Resolve the absolute path to the file (use `Read` only if you need to verify it exists; do not dump its contents to chat).
2. Open it in Markwright by running the OS command:
   - **Windows:** `start "" "<absolute path>"` — the Markwright installer registers itself as the default `.md` handler, so the file association routes to Markwright automatically.
   - **macOS:** `open "<absolute path>"`
   - **Linux:** `xdg-open "<absolute path>"`
3. If the user has the `mw` CLI on PATH, you can equivalently run `mw "<absolute path>"`. Don't worry about checking — `start` / `open` / `xdg-open` already does the right thing via the file association.

After opening, briefly confirm: "Opened `<filename>` in Markwright." Do **not** also paste the file contents into chat — that defeats the purpose of opening it in the dedicated viewer.

## When NOT to use Markwright

- The user is editing or transforming the file's contents (use `Edit` / `Write` directly, do not open Markwright)
- The user explicitly asks to see the raw markdown source (paste contents into chat)
- The file is not a `.md` / `.markdown` file
- You're inside a non-interactive automation context where opening a window would be disruptive

## Notes

- Markwright is a desktop app — the open command returns immediately while the window stays up. Don't wait on it.
- If the user has Markwright open already, the new file replaces the current document in the existing window (single-instance lock).
