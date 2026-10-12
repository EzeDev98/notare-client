import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

import { barIn, barOut } from '@/design-system/motion/patterns';
import { usePresence } from '@/design-system/motion/usePresence';
import { AccessoryStrip } from '@/design-system/ui';
import { insertVoiceClip } from '@/features/editor/voiceClip/recordingIds';
import { useCoarsePointer } from '@/shared/hooks/useCoarsePointer';

/**
 * Step 12f: on a touch screen, while the note is being edited, a strip with Undo
 * and Redo sits just above the keyboard. It is fixed and placed from
 * `window.visualViewport`, so it overlays the page and never moves the text.
 * On a desktop the same actions are Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z.
 */
export function NoteAccessoryStrip({ editor }: { editor: Editor }) {
  const coarse = useCoarsePointer();

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const undoManager = yUndoPluginKey.getState(current.state)?.undoManager;
      return {
        focused: current.isFocused,
        editable: current.isEditable,
        canUndo: (undoManager?.undoStack.length ?? 0) > 0,
        canRedo: (undoManager?.redoStack.length ?? 0) > 0,
      };
    },
  });

  const show = coarse && state.editable && state.focused;
  const { mounted, ref } = usePresence<HTMLDivElement>(show, { enter: barIn, exit: barOut });

  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip) return undefined;

    const view = window.visualViewport;
    const place = (): void => {
      const visibleBottom = view ? view.offsetTop + view.height : window.innerHeight;
      strip.style.bottom = `${String(Math.max(0, window.innerHeight - visibleBottom))}px`;
      strip.style.left = `${String(view?.offsetLeft ?? 0)}px`;
      strip.style.width = `${String(view?.width ?? window.innerWidth)}px`;
    };

    place();
    view?.addEventListener('resize', place);
    view?.addEventListener('scroll', place);
    return () => {
      view?.removeEventListener('resize', place);
      view?.removeEventListener('scroll', place);
    };
  }, [mounted, ref]);

  if (!mounted) return null;

  return createPortal(
    <AccessoryStrip
      ref={ref}
      docked
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      onUndo={() => {
        editor.chain().focus().undo().run();
      }}
      onRedo={() => {
        editor.chain().focus().redo().run();
      }}
      onVoice={() => {
        insertVoiceClip(editor);
      }}
    />,
    document.body,
  );
}
