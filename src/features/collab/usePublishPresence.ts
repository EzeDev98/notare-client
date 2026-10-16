import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import type { CurrentUser } from '@/features/auth/types';
import { cursorOf, localPresence } from '@/features/collab/presence';

/**
 * Tells the others who we are and where our caret is (step 16d). Only an editable, focused
 * editor shows a caret; otherwise the cursor is null and the person shows as an avatar only.
 * Awareness batches what is sent (awarenessRelay.ts), so this can fire on every change.
 */
export function usePublishPresence(
  awareness: Awareness | undefined,
  editor: Editor | null,
  user: CurrentUser | null,
  /** Whether this person can edit the note (read-only means a Viewer). */
  editing: boolean,
): void {
  const userId = user?.id;
  const lastCursor = useRef('');

  useEffect(() => {
    if (!awareness || !user) return;
    awareness.setLocalState(localPresence(user, editing));
    lastCursor.current = ''; // The cursor was reset with the state: publish it again on the next change.
  }, [awareness, user, editing]);

  useEffect(() => {
    if (!awareness || !editor || userId === undefined) return undefined;
    const publish = (): void => {
      if (editor.isDestroyed) return;
      const cursor = editor.isEditable && editor.isFocused ? cursorOf(editor.state) : null;
      const key = cursor ? JSON.stringify(cursor) : '';
      if (key === lastCursor.current) return;
      lastCursor.current = key;
      awareness.setLocalStateField('cursor', cursor);
    };
    editor.on('selectionUpdate', publish);
    editor.on('focus', publish);
    editor.on('blur', publish);
    editor.on('update', publish);
    return () => {
      editor.off('selectionUpdate', publish);
      editor.off('focus', publish);
      editor.off('blur', publish);
      editor.off('update', publish);
    };
  }, [awareness, editor, userId]);
}
