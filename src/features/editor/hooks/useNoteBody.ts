import { useEffect, useState } from 'react';
import { XmlElement, type Doc } from 'yjs';

import { BODY_FIELD } from '@/features/editor/editorExtensions';
import {
  SEED_CONVERTER_VERSION,
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
  /**
   * Built from text the server has not confirmed (a synced note with unsynced edits).
   * Shown, but not saved as a seed: it is rebuilt once the note has synced (step 18d).
   */
  provisional: boolean;
  /** The row's text when the body was opened, so a later server change is seen once. */
  sourceContent: string;
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
    provisional: body.seeded && row.version !== null && row.dirty === 1,
    sourceContent: row.content,
  };
}

/**
 * Another device changed the open note's text: show it now, as before.
 * AI tidy (no last editor) never changes a note under the user's hands: its
 * text is shown the next time the note opens, and an edit before then wins.
 */
function replacedByAnotherDevice(opened: OpenNote, live: NoteRow): boolean {
  return (
    live.dirty === 0 &&
    live.lastModifiedBy !== null &&
    live.content !== opened.sourceContent &&
    live.content !== bodyToPlainText(opened.doc)
  );
}

/**
 * Step 12b: the Y.Doc for the note on screen.
 *
 * - Opens from `bodyState`. A note with text but no `bodyState` is converted
 *   once from its old text and the result is saved (not marked as an edit).
 * - Every document change appends to `bodyState` and writes the derived
 *   `content` in the same Dexie write, through `setDraft`.
 * - If the server's text replaced ours, it is carried into the body when the
 *   note opens (openBody). An open note takes it at once only when another
 *   device made it; AI tidy's text waits until the note is next opened.
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
    } else if (opened.provisional && !live.bodyState && live.dirty === 0) {
      setOpened(open(live, opened.generation + 1));
    } else if (replacedByAnotherDevice(opened, live)) {
      setOpened(open(live, opened.generation + 1));
    }
  }

  const { doc, state, seeded, hasText, provisional, localId } = opened;

  useEffect(() => {
    if (seeded && hasText && !provisional) {
      void noteRepository.saveSeedBodyState(localId, state, SEED_CONVERTER_VERSION);
    }

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
  }, [doc, state, seeded, hasText, provisional, localId, setDraft]);

  return { doc, bodyKey: `${localId}:${opened.generation}` };
}
