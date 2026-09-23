import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { Markdown } from 'tiptap-markdown';

interface ConflictContentPreviewProps {
  content: string;
}

/**
 * A READ-ONLY formatted render of one side of a conflict, parsed with the
 * same Markdown stack EditorSurface.tsx uses to author notes — so
 * `# heading`/`**bold**`/`- item` show as real formatting here too, instead
 * of the literal syntax characters ConflictPanel.tsx used to render verbatim
 * (`{mine.content}` inside a `white-space: pre-wrap` div). This component
 * never emits changes — no `onContentChange`, no `onUpdate` — it exists
 * purely to display.
 *
 * A separate, minimal editor instance rather than reusing EditorSurface:
 * that component is sized and chromed for the full writing surface (60vh
 * min height, an accent caret, a focus ring deliberately suppressed for
 * something genuinely focusable) — none of which belongs on two compact,
 * side-by-side comparison panes capped at 18rem
 * (ConflictPanel.css's `.conflict__body`). This is the smallest thing that
 * parses Markdown into the same node set and lets that existing container
 * size and scroll it.
 */
export function ConflictContentPreview({ content }: ConflictContentPreviewProps) {
  const lastSetContentRef = useRef<string>(content);

  const editor = useEditor({
    content,
    editable: false,
    injectCSS: false,
    editorProps: {
      attributes: {
        class: 'conflict__preview',
      },
    },
    extensions: [
      StarterKit.configure({
        // Matches EditorSurface.tsx's own heading scale (typography.css: h1
        // is page-title-only, h2/h3 share one size), so a heading looks the
        // same whether you're writing it or comparing it here.
        heading: { levels: [1, 2, 3] },
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        linkify: true,
        // Same fix as EditorSurface.tsx, same reason: without this, a
        // plain multi-line note (single `\n`, no blank line between
        // paragraphs — true of every pre-existing note) collapses into one
        // run-on paragraph here too.
        breaks: true,
      }),
    ],
  });

  // `mine` and `theirs` are each read once per conflict, but this guards
  // the rare case of the prop changing under an already-mounted instance
  // anyway — the same defensive pattern EditorSurfaceBody uses for the real
  // editor, rather than assuming this component only ever mounts once per
  // value.
  useEffect(() => {
    if (!editor) return;
    if (content === lastSetContentRef.current) return;
    lastSetContentRef.current = content;
    editor.commands.setContent(content);
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
