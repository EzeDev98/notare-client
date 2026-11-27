/** Keyboard shortcuts in the editor. */
import { useEffect } from 'react';

export function useEditorShortcuts({ onSave }: { onSave: () => Promise<void> }): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 's') return;

      event.preventDefault();
      void onSave();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onSave]);
}
