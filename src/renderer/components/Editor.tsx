import {
  EditorContent,
  ReactNodeViewRenderer,
  createDocument,
  useEditor,
  type Editor as TiptapEditor
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Typography from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import { useEffect } from 'react';
import { SlashCommands } from '../extensions/SlashCommands';
import { MermaidCodeBlockView } from './MermaidCodeBlockView';

export type ExternalContent = {
  markdown: string;
  rev: number;
};

type Props = {
  initialMarkdown: string;
  // Content that changed on disk; replaces the doc in place whenever `rev` bumps.
  external: ExternalContent | null;
  onChange: (markdown: string, isInitial: boolean) => void;
};

const getMarkdown = (editor: TiptapEditor): string | undefined =>
  (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown();

export function Editor({ initialMarkdown, external, onChange }: Props): JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false
      }),
      CodeBlock.extend({
        addNodeView() {
          return ReactNodeViewRenderer(MermaidCodeBlockView);
        }
      }).configure({ HTMLAttributes: { class: 'mw-code-block' } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'mw-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      Typography,
      Markdown.configure({ html: false, tightLists: true, linkify: true, breaks: false, transformPastedText: true }),
      SlashCommands
    ],
    content: initialMarkdown,
    onUpdate: ({ editor }) => {
      const md = getMarkdown(editor);
      if (typeof md === 'string') onChange(md, false);
    }
  });

  useEffect(() => {
    if (editor) {
      const md = getMarkdown(editor);
      if (typeof md === 'string') onChange(md, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (!editor || !external) return;
    const parser = (editor.storage as { markdown: { parser: { parse: (md: string) => string } } }).markdown.parser;
    const next = createDocument(parser.parse(external.markdown), editor.schema);
    const { doc } = editor.state;
    // Replace only the span that differs, so the cursor maps through the change
    // and untouched blocks (e.g. rendered mermaid) keep their DOM.
    const start = doc.content.findDiffStart(next.content);
    const end = doc.content.findDiffEnd(next.content);
    if (start != null && end) {
      let { a: endA, b: endB } = end;
      const overlap = start - Math.min(endA, endB);
      if (overlap > 0) {
        endA += overlap;
        endB += overlap;
      }
      const tr = editor.state.tr
        .replace(start, endA, next.slice(start, endB))
        // Not a user edit: don't autosave it, and keep it out of the user's undo stack.
        .setMeta('preventUpdate', true)
        .setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    }
    const md = getMarkdown(editor);
    if (typeof md === 'string') onChange(md, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, external?.rev]);

  return (
    <div className="mw-editor-wrap">
      <EditorContent editor={editor} className="mw-editor" />
    </div>
  );
}
