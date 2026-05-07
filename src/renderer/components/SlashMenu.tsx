import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Editor, Range } from '@tiptap/core';
import type { SlashItem } from '../extensions/SlashCommands';

type Props = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  editor: Editor;
  range: Range;
};

export type SlashMenuRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashMenu = forwardRef<SlashMenuRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    }
  }));

  return (
    <div className="mw-slash-menu" ref={listRef}>
      {items.length === 0 ? (
        <div className="mw-slash-empty">No matches</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            data-index={i}
            className={`mw-slash-item ${i === selected ? 'mw-slash-item-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
            onMouseEnter={() => setSelected(i)}
          >
            <div className="mw-slash-icon">{item.icon}</div>
            <div className="mw-slash-text">
              <div className="mw-slash-title">{item.title}</div>
              <div className="mw-slash-desc">{item.description}</div>
            </div>
          </button>
        ))
      )}
    </div>
  );
});

SlashMenu.displayName = 'SlashMenu';
