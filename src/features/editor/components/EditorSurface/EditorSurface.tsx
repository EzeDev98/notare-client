import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef, type ReactNode } from 'react';

import { editorExtensions } from '@/features/editor/editorExtensions';
import { docToText, textToDoc } from '@/features/editor/plainTextBody';

import './EditorSurface.css';

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
   * Tracks which note's editor instance is currently live, so the RENDER
   * below (not a later effect) re-primes `lastEmittedContentRef` the instant
   * `focusKey` changes — before `useEditor` gets a chance to (re)construct
   * the editor for the new note and fire its construction-time `onUpdate`
   * (see that handler's own comment). An effect only runs after this render
   * commits, which is too late: TipTap's spurious first `onUpdate` for a
   * freshly (re)built instance can fire before any `useEffect` below gets a
   * chance to run, so the previous, effect-based re-prime still left
   * `lastEmittedContentRef` holding the PREVIOUS note's content at the
   * moment the new instance's spurious fire landed — which then looked like
   * a real edit and bumped `localUpdatedAt`, moving a note to the top of the
   * list just from switching into it.
   */
  const editorInstanceKeyRef = useRef<string | null>(focusKey ?? null);
  if ((focusKey ?? null) !== editorInstanceKeyRef.current) {
    editorInstanceKeyRef.current = focusKey ?? null;
    lastEmittedContentRef.current = content;
  }

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
      content: textToDoc(content),
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
      extensions: editorExtensions,
      onUpdate: ({ editor: instance }) => {
        const markdown = docToText(instance.getJSON());
        const next = markdown;
        // TipTap fires onUpdate once on mount/(re)construction even when
        // nothing was typed — ProseMirror's own initial-doc normalisation
        // (and tiptap-markdown's parse/serialise round trip) counts as a
        // transaction whether or not the text actually changed. Without
        // this guard, every note open called onContentChange with content
        // byte-identical to what was already there, which this component's
        // caller (NoteEditorHost) treats as a genuine edit — silently
        // marking the row dirty and restamping localUpdatedAt just from
        // OPENING it, which is what moved every note to the top of the
        // sidebar the instant it was clicked. Comparing against what this
        // editor instance last emitted (starting at the initial `content`
        // prop, via lastEmittedContentRef's own initialiser above) makes a
        // genuine no-op update a no-op all the way up, while a real edit —
        // even one that types back to the exact starting text — still goes
        // through, since `next` would differ from whatever WAS typed in
        // between.
        if (next === lastEmittedContentRef.current) return;
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
    // editor.isDestroyed: useEditor's own [focusKey] deps array tears the
    // PREVIOUS editor instance down (via .destroy()) whenever a note
    // switch rebuilds it. That destroy() nulls the instance's internal
    // commandManager, but TipTap's own `get commands()` (@tiptap/core)
    // dereferences it with no guard — so a fast enough note switch can
    // let this effect fire against an `editor` reference that is already
    // destroyed, throwing `Cannot read properties of null (reading
    // 'commands')` and taking the whole route down with it (caught here,
    // not silently — see the crash this fixed).
    if (!editor || editor.isDestroyed) return;
    if (content === lastEmittedContentRef.current) return;

    lastEmittedContentRef.current = content;
    editor.commands.setContent(textToDoc(content), { emitUpdate: false });
  }, [editor, content]);

  /*
   * Focus follows note identity, exactly like the old textarea's effect
   * (see `focusKey`'s own doc comment above) — gated on `focusKey`
   * CHANGING, not merely being present, so typing (which re-renders this
   * component constantly) never yanks focus mid-word.
   *
   * Does NOT re-prime `lastEmittedContentRef` anymore — `editorInstanceKeyRef`
   * above does that during RENDER, because this effect runs too late to beat
   * TipTap's construction-time `onUpdate` for a freshly rebuilt instance.
   */
  const previousFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Same destroyed-editor race as the content-sync effect above.
    if (!editor || editor.isDestroyed || readOnly) return;
    if (focusKey === null || focusKey === undefined || focusKey === previousFocusKeyRef.current) {
      return;
    }
    previousFocusKeyRef.current = focusKey;
    editor.commands.focus('end');
    // `content` deliberately excluded — this must fire only on a genuine
    // identity change, not on every keystroke's content update.
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
