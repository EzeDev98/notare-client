import { useEffect } from 'react';

/**
 * Cmd/Ctrl+S.
 *
 * The note already saves itself, so this changes nothing functionally — and it
 * is worth having anyway. People press it reflexively, and the browser's "Save
 * page as…" dialog appearing over a note editor is alarming: it looks like the
 * app has no idea what saving means.
 *
 * Intercepting it and flushing turns a jarring moment into a reassuring one —
 * the indicator moves to "Saving…" and then "Saved", answering the question
 * the reflex was asking.
 *
 * Bound to the DOCUMENT rather than the textarea, because the reflex fires
 * wherever focus happens to be.
 */
export function useEditorShortcuts({ onSave }: { onSave: () => Promise<void> }): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // metaKey on macOS, ctrlKey elsewhere. Checking both is simpler than
      // detecting the platform and is what the user expects on either.
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 's') return;

      // Without this the browser opens its save-page dialog.
      event.preventDefault();
      void onSave();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onSave]);
}
