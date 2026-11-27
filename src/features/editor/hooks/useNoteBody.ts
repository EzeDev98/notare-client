/** Opens a note's body document and keeps it in step with the device. */
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
  generation: number;
  persisted: boolean;
  hasText: boolean;
  provisional: boolean;
  sourceContent: string;
}

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

function replacedByAnotherDevice(opened: OpenNote, live: NoteRow): boolean {
  return (
    live.dirty === 0 &&
    live.lastModifiedBy !== null &&
    live.content !== opened.sourceContent &&
    live.content !== bodyToPlainText(opened.doc)
  );
}

export function useNoteBody(
  row: NoteRow,
  live: NoteRow,
  setDraft: SetDraft,
): { doc: Doc; bodyKey: string } {
  const [opened, setOpened] = useState(() => open(row, 0));

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
      const next = nextBodyState(doc, previous, update, sinceCompaction);
      previous = next.state;
      sinceCompaction = next.updatesSinceCompaction;

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
