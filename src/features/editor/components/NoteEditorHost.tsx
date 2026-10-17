import type { Editor } from '@tiptap/core';
import { useState, type ReactNode } from 'react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { StatusBanner } from '@/app/status/StatusBanner';
import { useCollab } from '@/features/collab/useCollab';
import { useMergeToast } from '@/features/collab/useMergeToast';
import { usePresencePeople } from '@/features/collab/usePresencePeople';
import { bodyToPlainText } from '@/features/editor/noteBody';
import { NoteBodyEditor } from '@/features/editor/components/NoteBodyEditor/NoteBodyEditor';
import { canEdit, canTranscribe } from '@/features/notes/permissions';
import { NoteEditorHeader } from '@/features/editor/components/NoteEditorHeader/NoteEditorHeader';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
import { insertChecklist } from '@/features/editor/editorCommands';
import { useInsertVoice } from '@/features/editor/voiceClip/useInsertVoice';
import { useEditorActions } from '@/features/editor/hooks/useEditorActions';
import { useNoteBody } from '@/features/editor/hooks/useNoteBody';
import {
  pickAccess,
  useAfterFlush,
  useLeaveWhenRemoved,
  useLiveAccess,
} from '@/features/editor/hooks/useLiveAccess';
import { useKeepCopy, useShareAccess } from '@/features/editor/hooks/useShareAccess';
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
  // Live editing: only for a note the server already knows (step 16c feeds its state to the status word).
  const live = useCollab({ noteId: editor.row.serverId, doc, plainText: bodyToPlainText });
  const collab = editor.row.serverId === null ? undefined : live.state;
  const sessionUser = useSessionUser();
  const presence = usePresencePeople(live.awareness);
  useMergeToast(collab, presence);
  const more = useEditorActions(editor.row, doc, live.release);
  const polledAccess = useShareAccess(editor.row);
  const liveAccess = useLiveAccess(editor.row, collab);
  // A change turns the note read-only (or editable) only after the last edit is saved on this device.
  const access = useAfterFlush(pickAccess(polledAccess, liveAccess.change), editor.flush);
  useLeaveWhenRemoved(editor.row, liveAccess.removedBy, editor.flush);
  const keepCopy = useKeepCopy(editor.row);
  // A change to your access takes effect at once: the note turns read-only or editable to match.
  const viewRow = access ? { ...editor.row, role: access.role } : editor.row;
  // Owners and Editors may transcribe a clip; the server allows it since step 17d (B-11). A change of
  // role applies at once, so a demoted Editor loses the button.
  const mayTranscribe = canTranscribe(viewRow.role);
  useTranscriptionRunner(row.localId, mayTranscribe);

  useEditorShortcuts({ onSave: editor.flush });

  // SaveIndicator shows the note's one status word (step 8h).
  return (
    <>
      <NoteEditorHeader
        row={viewRow}
        more={more}
        collab={collab}
        presence={presence}
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

      <NoteDateHeading key={editor.row.localId} row={editor.row} />

      <StatusBanner access={access} onKeepCopy={keepCopy} />

      <NoteBodyEditor
        key={bodyKey}
        noteId={row.localId}
        doc={doc}
        onEditor={setTiptap}
        awareness={live.awareness}
        user={sessionUser}
        readOnly={!canEdit(viewRow.role)}
        canTranscribe={mayTranscribe}
        contentAccessory={contentAccessory}
      />
    </>
  );
}
