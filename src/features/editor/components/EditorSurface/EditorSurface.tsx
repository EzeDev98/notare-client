import type { Editor, Storage } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, type ReactNode } from 'react';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';

import './EditorSurface.css';

/**
 * `tiptap-markdown` ships `MarkdownStorage` but does not merge it into
 * `@tiptap/core`'s own `Storage` interface (no `declare module` in its
 * `.d.ts`) — so `editor.storage.markdown` is genuinely untyped, not a
 * mistake on this file's part. One cast, in one place, documented here
 * rather than repeated at every call site.
 */
function getMarkdownContent(editor: Editor): string {
  return (editor.storage as Storage & { markdown: MarkdownStorage }).markdown.getMarkdown();
}

interface EditorSurfaceSharedProps {
  /** Read-only for a READ collaborator, or a voice share (always read-only today). */
  readOnly?: boolean;
  onBlur?: () => void;
}

interface EditorSurfaceBodyProps extends EditorSurfaceSharedProps {
  hideBody?: false;
  content: string;
  onContentChange: (value: string) => void;
  /** Optional content rendered in document flow around the body text. */
  contentAccessory?: ReactNode;
  /**
   * 1A: identifies which note is currently loaded, so the body can be
   * refocused whenever the surface switches to a DIFFERENT note — not just
   * on first mount. `autoFocus` alone only ever fires once: NoteEditorHost
   * stays mounted across note switches (see useNoteEditor.ts's note on why
   * it stopped remounting via `key={row.localId}`), so without this a
   * plain `autoFocus` prop would only focus the very first note opened in
   * a session.
   *
   * Pass the caller's stable note identity (NoteEditorHost passes
   * `row.localId`). Omit it to opt out of auto-focus entirely — SharedNote
   * does, deliberately (see the identity-key comment inside
   * EditorSurfaceBody below).
   */
  focusKey?: string | null;
}

interface EditorSurfaceHeadingProps extends EditorSurfaceSharedProps {
  /**
   * Skips the body editor entirely, showing `heading` instead.
   *
   * The ONLY remaining caller is SharedVoiceDetail: a standalone voice
   * share has no text body, so the note surface stops at a heading — same
   * visual treatment `/shared/:id`'s body view gets, just without
   * reserving the editor's 60vh body for an empty, read-only field.
   */
  hideBody: true;
  /**
   * NOT a note title — the note domain has none (1B/2A). This is
   * SharedVoiceDetail's read-only display of the recording's filename
   * (`VoiceNote.originalFilename`), reusing this component purely for its
   * chrome. Whether that mechanism survives at all is Step 9E's decision,
   * not this one's — it stays narrowly named `heading` so nothing here
   * reads as a title field waiting to come back.
   *
   * No `onHeadingChange`: every current caller passes `readOnly`. If a
   * future caller needs to edit it, add the handler then rather than
   * plumbing an unused one now.
   */
  heading: string;
}

type EditorSurfaceProps = EditorSurfaceBodyProps | EditorSurfaceHeadingProps;

/**
 * Same fixed cap the old `<textarea maxLength={20_000}>` enforced for free.
 * TipTap has no built-in equivalent, so `onUpdate` below truncates the
 * serialized markdown itself. `useNoteEditor.ts`'s `keepBoth` already slices
 * a merged conflict to the same number for the same reason — kept in sync
 * here, not imported from there, since that file is sync-engine code and
 * this one is display code (`docs/architecture/structure.md`'s layering).
 */
const MAX_CONTENT_LENGTH = 20_000;

/**
 * The writing surface.
 *
 * Two mutually exclusive shapes, not one component with optional pieces:
 * every real caller is either "a body to write in" (NoteEditorHost,
 * SharedNote) or "a single read-only heading and nothing else"
 * (SharedVoiceDetail) — never both, not since 1B/2A removed the note title
 * that used to sit above the body. `hideBody` is the discriminant, and each
 * shape is its own component below so the heading-only caller never pays
 * for constructing a TipTap editor it will never render.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  if (props.hideBody) {
    return (
      <div className="editor-surface">
        <input
          className="editor-surface__heading"
          aria-label="Voice note name"
          value={props.heading}
          readOnly
        />
      </div>
    );
  }

  return <EditorSurfaceBody {...props} />;
}

/**
 * ISOLATED FROM THE STATUS on purpose. This re-renders on every keystroke,
 * which is unavoidable for a live-typed document; the save indicator and
 * page chrome live outside it and re-render only when they change. Same
 * state in one component would repaint the whole page per character.
 *
 * CONTENT IS STILL A PLAIN STRING everywhere outside this file — the
 * server's `NoteResponse.content`/`CreateNoteRequest.content`, the sync
 * engine's diffing and conflict handling, and `useNoteEditor.ts`'s whole
 * local-first model all stay exactly as they were. What changes here is
 * only what RENDERS that string: it is Markdown now (still perfectly valid
 * plain text — every existing note already satisfies it), and TipTap
 * renders it as live formatting instead of showing the raw `#`/`**`
 * characters, converting pasted Markdown/HTML the same way on the way in.
 *
 * NOT a controlled component the way the old `<textarea value={content}>`
 * was — TipTap owns its own document and has no `value` prop. Faking
 * "controlled" naively (calling `setContent` every time the `content` prop
 * changes) would mean every keystroke's own round trip — this editor's
 * `onUpdate` calls `onContentChange`, the parent re-renders, `content`
 * comes back in as a prop — resets the document and the caret on every
 * character. `lastEmittedContentRef` is this component's version of
 * `useNoteEditor.ts`'s own `draftOverride`: it remembers the Markdown THIS
 * editor instance most recently produced, so the sync effect below can
 * tell "the prop changed because I just typed" (skip — the DOM already
 * matches) from "the prop changed for some other reason" — a note switch,
 * a conflict resolution (`keepMine`/`useTheirs`/`keepBoth`), or a cross-tab
 * edit arriving through Dexie's live query — and only then push it in.
 */
function EditorSurfaceBody({
  content,
  onContentChange,
  focusKey,
  contentAccessory,
  readOnly = false,
  onBlur,
}: EditorSurfaceBodyProps) {
  const lastEmittedContentRef = useRef<string>(content);

  /*
   * The recreate-on-switch key. NoteEditorHost always passes `focusKey`
   * (`row.localId`), so a note switch tears down and rebuilds the editor
   * with the new note's own initial content — the simplest correct thing,
   * since nothing about ProseMirror's internal state should carry over
   * between two different notes anyway.
   *
   * SharedNote passes no `focusKey` at all (see its own prop comment
   * above), so this falls back to a constant — ONE editor instance for
   * that component's entire lifetime, same as before. Correctness for
   * SharedNote's content changing over time does not depend on this key:
   * the content-sync effect below reacts to the `content` prop directly,
   * independent of whether the editor was just (re)built or has been
   * sitting there since mount.
   */
  const editor = useEditor(
    {
      content,
      editable: !readOnly,
      // TipTap's own injected stylesheet lands OUTSIDE this app's @layer
      // system entirely, which means it would beat every layered rule in
      // EditorSurface.css regardless of layer order — exactly the "styles
      // that start causing UI conflicts" this must not do. Off; the CSS
      // this surface needs is hand-written below, using the app's own
      // tokens, the same way every other component here already works.
      injectCSS: false,
      // Focus is driven by the identity effect below, same as the old
      // textarea's own effect — not TipTap's own autofocus-on-construct.
      autofocus: false,
      editorProps: {
        attributes: {
          class: 'editor-surface__content',
          'aria-label': 'Note content',
        },
      },
      extensions: [
        StarterKit.configure({
          // Three levels, matching the app's own heading scale
          // (typography.css: h1 is page-title-only, h2/h3 share one size)
          // rather than the six Markdown nominally allows.
          heading: { levels: [1, 2, 3] },
          // StarterKit bundles Link (v3) with `openOnClick: true` by
          // default — clicking a link inside an EDITABLE note would
          // navigate the browser away instead of placing the caret, which
          // is exactly the kind of interaction conflict step 1 was told to
          // avoid. Off here; nothing else about Link's config changes.
          link: { openOnClick: false },
        }),
        Markdown.configure({
          // Content stays Markdown TEXT end to end — never HTML. The
          // server, the sync engine, and search all assume a plain
          // string; HTML output would silently break every one of them.
          html: false,
          tightLists: true,
          linkify: true,
          // CommonMark treats a single `\n` inside a paragraph as
          // insignificant whitespace, not a line break — verified directly:
          // with this OFF, `one\ntwo\nthree` (a plain multi-line note, which
          // is every note ever written in the old <textarea>, since it had
          // no concept of "blank line between paragraphs") collapses to one
          // run-on paragraph, "one two three", the instant it is opened.
          // `breaks: true` makes a single newline a real hard break
          // (`<br>`) instead — matching exactly how a <textarea> always
          // rendered `\n`, so every note already in the database still
          // looks the way it did before this rewrite. Round-trip verified
          // stable: serializing and re-parsing produces byte-identical
          // Markdown, so this does not churn stored content on open.
          breaks: true,
          // The actual fix for the reported bug: pasted `# heading`,
          // `**bold**`, `- item` etc. become real formatting instead of
          // literal characters landing in the document.
          transformPastedText: true,
          // ...and copying text back OUT of a note gives Markdown, not
          // HTML, so round-tripping through the system clipboard stays
          // lossless in both directions.
          transformCopiedText: true,
        }),
      ],
      onUpdate: ({ editor: instance }) => {
        const markdown = getMarkdownContent(instance);
        const next =
          markdown.length > MAX_CONTENT_LENGTH ? markdown.slice(0, MAX_CONTENT_LENGTH) : markdown;
        lastEmittedContentRef.current = next;
        onContentChange(next);
      },
      onBlur: () => {
        onBlur?.();
      },
    },
    [focusKey ?? '__no-focus-key__'],
  );

  // `readOnly` can change after construction (a collaborator's permission
  // changing) — `useEditor`'s own `editable` option is read once, at
  // construction, not kept live.
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  /*
   * Content sync — the other half of "not controlled, but behaves like it
   * is" from this component's own doc comment above. Only pushes a change
   * into the DOM when the prop differs from what THIS editor last
   * produced; a plain typing round trip never reaches `setContent` at all.
   */
  useEffect(() => {
    if (!editor) return;
    if (content === lastEmittedContentRef.current) return;

    lastEmittedContentRef.current = content;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  /*
   * Focus follows note identity, exactly like the old textarea's effect
   * (see `focusKey`'s own doc comment above) — gated on `focusKey`
   * CHANGING, not merely being present, so typing (which re-renders this
   * component constantly) never yanks focus mid-word. Also re-primes
   * `lastEmittedContentRef` to the new note's own content: the editor
   * instance was just rebuilt from scratch for it (the `useEditor` deps
   * array above), so the ref must not still be holding the PREVIOUS note's
   * last-known text.
   */
  const previousFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor || readOnly) return;
    if (focusKey === null || focusKey === undefined || focusKey === previousFocusKeyRef.current) {
      return;
    }
    previousFocusKeyRef.current = focusKey;
    lastEmittedContentRef.current = content;
    editor.commands.focus('end');
    // `content` deliberately excluded — this must fire only on a genuine
    // identity change, not on every keystroke's content update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, focusKey, readOnly]);

  return (
    <div className="editor-surface">
      <div className="editor-surface__body">
        <EditorContent editor={editor} />
        {contentAccessory}
      </div>
    </div>
  );
}
