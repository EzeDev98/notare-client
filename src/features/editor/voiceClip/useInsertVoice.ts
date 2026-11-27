/** Inserts a voice clip block into the note. */
import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';

import { STATUS_COPY } from '@/app/status/statusContent';
import { useToast } from '@/design-system/ui';
import { isStorageFull } from '@/features/notes/status/storageFull';

import { insertVoiceClip } from './recordingIds';

export function useInsertVoice(): (editor: Editor) => void {
  const { toast } = useToast();

  return useCallback(
    (editor: Editor) => {
      if (isStorageFull()) {
        toast(STATUS_COPY.noSpaceToRecord, { tone: 'error' });
        return;
      }
      insertVoiceClip(editor);
    },
    [toast],
  );
}
