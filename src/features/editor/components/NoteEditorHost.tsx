import { useState, type ReactNode } from 'react';

import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
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

  useEditorShortcuts({ onSave: editor.flush });


  /*
   * No word count here any more, and SaveIndicator renders nothing at all
   * for the routine states (its own doc comment explains why) — so this is
   * the ONLY thing that can sit above the editor, and only when there is
   * genuinely something worth a person's attention. The rest of the time
   * this renders nothing, and the note's own first line starts right at
   * the top of the writing surface.
   */
  return (
    <>
      <SaveIndicator state={editor.saveState} />

      <NoteDateHeading key={editor.row.localId} row={editor.row} />

      <EditorSurface
        content={editor.row.content}
        focusKey={editor.row.localId}
        onContentChange={(value) => {
          editor.setDraft({ content: value });
          editor.markEdited();
        }}
        contentAccessory={contentAccessory}
      />
    </>
  );
}