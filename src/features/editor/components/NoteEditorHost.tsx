import type { Editor } from '@tiptap/core';
import { useState, type ReactNode } from 'react';

import { StatusBanner } from '@/app/status/StatusBanner';
import { NoteBodyEditor } from '@/features/editor/components/NoteBodyEditor/NoteBodyEditor';
import { canEdit, canTranscribe } from '@/features/notes/permissions';
import { NoteEditorHeader } from '@/features/editor/components/NoteEditorHeader/NoteEditorHeader';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
import { insertChecklist } from '@/features/editor/editorCommands';
import { useInsertVoice } from '@/features/editor/voiceClip/useInsertVoice';
import { useEditorActions } from '@/features/editor/hooks/useEditorActions';
import { useNoteBody } from '@/features/editor/hooks/useNoteBody';
import { useTranscriptionRunner } from '@/features/voice/hooks/useTranscriptionRunner';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { parseServerDateTime } from '@/lib/time';

interface NoteEditorHostProps {
  /** The local row. Exists before any server has seen this note. */
  row: NoteRow;
  /** Optional content rendered inside the writing surface around the body. */
  contentAccessory?: ReactNode;
}

/**
 * "21 September 2026, 9:38 pm" — shown once at the top of every note, like
 * Apple Notes. Frozen on first render for a given note (parent passes
 * key=localId): a new note has no server timestamp yet, and swapping to the
 * server's zoneless one after the first sync would change the text mid-typing.
 */
function NoteDateHeading({ row }: { row: NoteRow }) {
  const [text] = useState(() => {
    const date =
      (row.createdAt !== null ? parseServerDateTime(row.createdAt) : null) ??
      new Date(row.localUpdatedAt);
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
  });

  return <p className="note-date">{text}</p>;
}

export function NoteEditorHost({ row, contentAccessory }: NoteEditorHostProps) {
  const editor = useNoteEditor(row);
  const insertVoice = useInsertVoice();
  const { doc, bodyKey } = useNoteBody(row, editor.row, editor.setDraft);
  const [tiptap, setTiptap] = useState<Editor | null>(null);
  const more = useEditorActions(editor.row, doc);
  // Owners only until the server lets editors transcribe shared clips (step 17, B-11).
  const mayTranscribe = canTranscribe(editor.row.role) && editor.row.role === 'owner';
  useTranscriptionRunner(row.localId, mayTranscribe);

  useEditorShortcuts({ onSave: editor.flush });

  // SaveIndicator shows the note's one status word (step 8h).
  return (
    <>
      <NoteEditorHeader
        row={editor.row}
        more={more}
        onInsertChecklist={
          tiptap
            ? () => {
                insertChecklist(tiptap);
              }
            : undefined
        }
        onInsertVoice={
          tiptap
            ? () => {
                insertVoice(tiptap);
              }
            : undefined
        }
      />

      <StatusBanner />

      <NoteDateHeading key={editor.row.localId} row={editor.row} />

      <NoteBodyEditor
        key={bodyKey}
        noteId={row.localId}
        doc={doc}
        onEditor={setTiptap}
        readOnly={!canEdit(editor.row.role)}
        canTranscribe={mayTranscribe}
        contentAccessory={contentAccessory}
      />
    </>
  );
}
