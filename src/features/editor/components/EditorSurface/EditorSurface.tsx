import { useLayoutEffect, useRef, type ReactNode } from 'react';

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
   * `row.localId`). Omit it to opt out of auto-focus entirely.
   */
  focusKey?: string | null;
}

interface EditorSurfaceHeadingProps extends EditorSurfaceSharedProps {
  /**
   * Skips the body textarea entirely, showing `heading` instead.
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
 * that used to sit above the body. `hideBody` is the discriminant.
 *
 * ISOLATED FROM THE STATUS on purpose. This re-renders on every keystroke,
 * which is unavoidable for a controlled input; the save indicator and page
 * chrome live outside it and re-render only when they change. Same state in
 * one component would repaint the whole page per character.
 *
 * Controlled rather than uncontrolled. Uncontrolled avoids the re-render, and
 * makes "the server sent different content, update the field" awkward — which
 * 6E's conflict resolution needs. Correctness over an unmeasured
 * micro-optimisation; if a very long note lags, this component is already the
 * unit to optimise.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  const { readOnly = false, onBlur } = props;

  const contentRef = useRef<HTMLTextAreaElement>(null);

  /*
   * Auto-grow. A textarea has a fixed height and scrolls internally, which is
   * the opposite of §30's "digital sheet of paper" — the page should scroll,
   * not a box inside it.
   *
   * THE ORDER MATTERS: height must be reset to 'auto' BEFORE reading
   * scrollHeight. scrollHeight is bounded below by the current height, so
   * measuring without resetting reports the old value and the textarea grows
   * but never shrinks. That bug looks like "deleting text does nothing".
   *
   * A genuine effect — measuring rendered DOM is synchronisation with
   * something outside React.
   *
   * `field-sizing: content` does all of this in one CSS line and is
   * Chrome-only for now.
   */
  // `content` only exists on the body variant; undefined (heading-only) is
  // a no-op height reset below, harmless and cheap.
  const contentForHeightEffect = props.hideBody ? null : props.content;

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    /*
     * Measure before paint. This is critical when switching between notes:
     * a long note must not first paint at the one-row textarea height and
     * then expand after the frame is already visible.
     */
    element.style.height = 'auto';
    element.style.height = `${String(element.scrollHeight)}px`;
  }, [contentForHeightEffect]);

  /*
   * 1A: focus follows note identity, not mount.
   *
   * Gated on `focusKey` CHANGING (compared against the previous value in a
   * ref), not merely being present — `content` changes on every keystroke,
   * which re-renders this component, and re-focusing then would yank the
   * caret to the end of the field mid-word. Keying off `localId` instead
   * means this only fires on genuine note switches (and on first mount,
   * since the ref starts at `null`).
   */
  const previousFocusKeyRef = useRef<string | null>(null);
  // `focusKey` only exists on the body variant; undefined (heading-only)
  // never matches a real key, so the effect below just no-ops for it.
  const focusKeyForFocusEffect = props.hideBody ? null : (props.focusKey ?? null);

  useLayoutEffect(() => {
    if (props.hideBody || readOnly) return;
    if (focusKeyForFocusEffect === null || focusKeyForFocusEffect === previousFocusKeyRef.current) {
      return;
    }
    previousFocusKeyRef.current = focusKeyForFocusEffect;

    const element = contentRef.current;
    if (!element) return;

    element.focus();
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }, [focusKeyForFocusEffect, props.hideBody, readOnly]);

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

  return (
    <div className="editor-surface">
      <div className="editor-surface__body">
        <textarea
          ref={contentRef}
          className="editor-surface__content"
          aria-label="Note content"
          placeholder=""
          value={props.content}
          readOnly={readOnly}
          maxLength={20_000}
          rows={1}
          onChange={(event) => {
            props.onContentChange(event.target.value);
          }}
          onBlur={onBlur}
        />

        {props.contentAccessory}
      </div>
    </div>
  )
}
