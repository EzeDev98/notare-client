import { useEffect, useState } from 'react';
import { XmlElement, type Doc } from 'yjs';

import { BODY_FIELD } from '@/features/editor/editorExtensions';
import {
  bodyToPlainText,
  nextBodyState,
  openBody,
  type OpenedBody,
} from '@/features/editor/noteBody';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

type SetDraft = (changes: { content: string; bodyState: Uint8Array }) => void;

interface OpenNote extends OpenedBody {
  localId: string;
  /** Goes up each time the body is rebuilt, so the editor mounts fresh. */
  generation: number;
  /** True once the live row shows a saved bodyState. */
  persisted: boolean;
  /** A blank draft has no text worth saving as a seed. */
  hasText: boolean;
}

/** The clip ids in the body, in order. A change here is an edit even if the text is the same. */
function clipSignature(doc: Doc): string {
  const ids: string[] = [];
  const walk = (node: unknown): void => {
    if (!(node instanceof XmlElement)) return;
    if (node.nodeName === 'voiceClip') ids.push(String(node.getAttribute('clipId')));
    node.forEach(walk);
  };
  doc.getXmlFragment(BODY_FIELD).forEach(walk);
  return ids.join(',');
}

function open(row: NoteRow, generation: number): OpenNote {
  const body = openBody(row);
  return {
    ...body,
    localId: row.localId,
    generation,
    persisted: !body.seeded,
    hasText: row.content.trim() !== '',
  };
}

/**
 * Step 12b: the Y.Doc for the note on screen.
 *
 * - Opens from `bodyState`. A note with text but no `bodyState` is converted
 *   once from its old text and the result is saved (not marked as an edit).
 * - Every document change appends to `bodyState` and writes the derived
 *   `content` in the same Dexie write, through `setDraft`.
 * - If the server's text replaced ours (the saved body was dropped), the body
 *   is rebuilt from that text.
 *
 * `row` is the note being opened. `live` is the row the editor host follows.
 */
export function useNoteBody(
  row: NoteRow,
  live: NoteRow,
  setDraft: SetDraft,
): { doc: Doc; bodyKey: string } {
  const [opened, setOpened] = useState(() => open(row, 0));

  // Adjusting state while rendering: the documented way to reset state when a
  // prop changes. React re-renders at once with the new value.
  if (opened.localId !== row.localId) {
    setOpened(open(row, 0));
  } else if (live.localId === opened.localId) {
    if (!opened.persisted && live.bodyState) {
      setOpened({ ...opened, persisted: true });
    } else if (opened.persisted && !live.bodyState && live.dirty === 0) {
      setOpened(open(live, opened.generation + 1));
    }
  }

  const { doc, state, seeded, hasText, localId } = opened;

  useEffect(() => {
    if (seeded && hasText) void noteRepository.saveSeedBodyState(localId, state);

    let previous = state;
    let sinceCompaction = 0;
    let lastContent = bodyToPlainText(doc);
    let lastClips = clipSignature(doc);

    const onUpdate = (update: Uint8Array): void => {
      // Always fold the update in, so a skipped write below loses nothing.
      const next = nextBodyState(doc, previous, update, sinceCompaction);
      previous = next.state;
      sinceCompaction = next.updatesSinceCompaction;

      // Yjs also fires for editor start-up housekeeping. If the text did not
      // change, this is not an edit: opening a note must not mark it dirty.
      const content = bodyToPlainText(doc);
      const clips = clipSignature(doc);
      if (content === lastContent && clips === lastClips) return;
      lastContent = content;
      lastClips = clips;

      setDraft({ content, bodyState: previous });
    };

    doc.on('update', onUpdate);
    return () => {
      doc.off('update', onUpdate);
    };
  }, [doc, state, seeded, hasText, localId, setDraft]);

  return { doc, bodyKey: `${localId}:${opened.generation}` };
}
