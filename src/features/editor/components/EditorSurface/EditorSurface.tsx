import { useEffect, useRef } from 'react';

import './EditorSurface.css';

interface EditorSurfaceProps {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  /** Read-only for a READ collaborator (Step 9). */
  readOnly?: boolean;
  onBlur?: () => void;
}

/**
 * The writing surface: a title field and a body, and nothing else.
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
export function EditorSurface({
  title,
  content,
  onTitleChange,
  onContentChange,
  readOnly = false,
  onBlur,
}: EditorSurfaceProps) {
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
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    element.style.height = 'auto';
    element.style.height = `${String(element.scrollHeight)}px`;
  }, [content]);

  return (
    <div className="editor-surface">
      {/*
        An input, not an h1 with contentEditable. contentEditable brings
        pasted formatting, unpredictable selection behaviour and no native
        maxLength — for a plain-text title that is all cost.
      */}
      <input
        className="editor-surface__title"
        // A visible placeholder is not a label. Screen readers announce this.
        aria-label="Note title"
        placeholder="Untitled"
        value={title}
        readOnly={readOnly}
        maxLength={255}
        onChange={(event) => {
          onTitleChange(event.target.value);
        }}
        onBlur={onBlur}
      />

      <textarea
        ref={contentRef}
        className="editor-surface__content"
        aria-label="Note content"
        placeholder="Start writing…"
        value={content}
        readOnly={readOnly}
        // The server's limit. Enforced here because a 400 carries no field
        // detail for this, so the user would lose the overflow with no
        // explanation.
        maxLength={20_000}
        rows={1}
        onChange={(event) => {
          onContentChange(event.target.value);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}
