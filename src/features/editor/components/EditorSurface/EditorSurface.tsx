import { useEffect, useRef, type ReactNode } from 'react';

import './EditorSurface.css';

interface EditorSurfaceProps {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  /** Read-only for a READ collaborator (Step 9). */
  readOnly?: boolean;
  onBlur?: () => void;
  /** Optional content rendered in document flow around the body text. */
  contentAccessory?: ReactNode;
  /**
   * Skips the body textarea entirely.
   *
   * For a standalone shared voice note there is no text body — it is a
   * note container holding only a title and a recording. Rendering an
   * empty, read-only textarea there would reserve `.editor-surface__body`'s
   * 60vh of blank space and show a "Start writing…" placeholder the
   * recipient can never act on. `hideBody` keeps the title (so the surface
   * still reads as the same note interface) while letting the caller place
   * voice content directly below via its own markup.
   */
  hideBody?: boolean;
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
  contentAccessory,
  hideBody = false,
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
      <input
        className="editor-surface__title"
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

      {hideBody ? null : (
        <div className="editor-surface__body">
          {content.trim() === '' ? contentAccessory : null}

          <textarea
            ref={contentRef}
            className="editor-surface__content"
            aria-label="Note content"
            placeholder="Start writing…"
            value={content}
            readOnly={readOnly}
            maxLength={20_000}
            rows={1}
            onChange={(event) => {
              onContentChange(event.target.value);
            }}
            onBlur={onBlur}
          />

          {content.trim() !== '' ? contentAccessory : null}
        </div>
      )}
    </div>
  )
}
