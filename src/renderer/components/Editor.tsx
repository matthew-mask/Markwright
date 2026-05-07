import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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

type Props = {
  initialMarkdown: string;
  onChange: (markdown: string, isInitial: boolean) => void;
};

export function Editor({ initialMarkdown, onChange }: Props): JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { HTMLAttributes: { class: 'mw-code-block' } }
      }),
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
      const md = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown();
      if (typeof md === 'string') onChange(md, false);
    }
  });

  useEffect(() => {
    if (editor) {
      const md = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown();
      if (typeof md === 'string') onChange(md, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="mw-editor-wrap">
      <EditorContent editor={editor} className="mw-editor" />
    </div>
  );
}
