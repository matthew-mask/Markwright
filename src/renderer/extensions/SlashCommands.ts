import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { SlashMenu, type SlashMenuRef } from '../components/SlashMenu';

export type SlashItem = {
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  run: (props: { editor: Editor; range: Range }) => void;
};

const ITEMS: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: '¶',
    keywords: ['text', 'paragraph', 'p'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('paragraph').run()
  },
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'H1',
    keywords: ['h1', 'title', 'heading1'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    keywords: ['h2', 'heading2'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    keywords: ['h3', 'heading3'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
  },
  {
    title: 'Bullet list',
    description: 'A simple bulleted list',
    icon: '•',
    keywords: ['ul', 'bullet', 'list', 'unordered'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
  },
  {
    title: 'Numbered list',
    description: 'A list with numbering',
    icon: '1.',
    keywords: ['ol', 'numbered', 'ordered'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
  },
  {
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: '☐',
    keywords: ['todo', 'task', 'checkbox', 'tasks'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: '❝',
    keywords: ['quote', 'blockquote', 'q'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
  },
  {
    title: 'Code block',
    description: 'Capture a code snippet',
    icon: '</>',
    keywords: ['code', 'pre', 'snippet'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCodeBlock().run()
  },
  {
    title: 'Divider',
    description: 'Visually separate sections',
    icon: '—',
    keywords: ['hr', 'divider', 'rule', 'separator'],
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table with header row',
    icon: '⊞',
    keywords: ['table', 'grid'],
    run: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
  }
];

function filterItems(query: string): SlashItem[] {
  if (!query) return ITEMS;
  const q = query.toLowerCase();
  return ITEMS.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      i.keywords.some((k) => k.toLowerCase().startsWith(q))
  );
}

type SlashSuggestionOptions = Omit<SuggestionOptions<SlashItem>, 'editor'>;

export const SlashCommands = Extension.create<{ suggestion: SlashSuggestionOptions }>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => {
          props.run({ editor, range });
        },
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor
              });

              if (!props.clientRect) return;

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'mw-slash',
                arrow: false,
                offset: [0, 6],
                maxWidth: 'none'
              });
            },
            onUpdate(props) {
              component?.updateProps(props);
              if (props.clientRect && popup) {
                popup.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              }
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            }
          };
        }
      } as SlashSuggestionOptions
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        ...this.options.suggestion
      })
    ];
  }
});
