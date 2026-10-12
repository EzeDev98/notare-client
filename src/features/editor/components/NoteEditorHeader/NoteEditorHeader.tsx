import { ChevronLeft, Ellipsis, Plus } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { AvatarStack, Button, ContextMenu, IconButton, InsertMenu } from '@/design-system/ui';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import type { EditorMoreActions } from '@/features/editor/hooks/useEditorActions';
import { discardDraft } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { canEdit, canShare } from '@/features/notes/permissions';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import './NoteEditorHeader.css';

interface NoteEditorHeaderProps {
  /** The note on screen (live). */
  row: NoteRow;
  /** The + menu (step 12e). The + button is drawn only when one of these is given. */
  onInsertVoice?: (() => void) | undefined;
  onInsertChecklist?: (() => void) | undefined;
  /** The more menu (step 12e). The button is drawn only when given. */
  more?: EditorMoreActions | undefined;
}

/** Keeps the caret (and the phone keyboard) in the note when a header button is pressed. */
function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}

/**
 * The editor header, 56px (master 6.4, step 12d). Left to right: Back (phone
 * only), + insert, spacer, status, avatars, Share, more.
 */
export function NoteEditorHeader({
  row,
  onInsertVoice,
  onInsertChecklist,
  more,
}: NoteEditorHeaderProps) {
  const navigate = useNavigate();
  const clipCount = useLiveQuery(async () => clipRepository.countForNote(row.localId), [row.localId]) ?? 0;
  const empty = isEmptyNote({ content: row.content, clipCount });

  // Collaborators of your own notes arrive with presence (step 16).
  const people =
    row.role !== 'owner' && row.ownerName ? [{ name: row.ownerName, tint: 1 as const }] : [];

  const goBack = (): void => {
    // A blank draft is forgotten: no row, no server record, no toast (step 8d).
    discardDraft(row.localId);
    void navigate(ROUTES.notes());
  };

  const showInsert = canEdit(row.role) && (onInsertVoice !== undefined || onInsertChecklist !== undefined);

  return (
    <div className="note-header">
      <IconButton className="note-header__back" icon={ChevronLeft} label="Back" onClick={goBack} />

      {showInsert ? (
        <InsertMenu onVoice={onInsertVoice} onChecklist={onInsertChecklist}>
          {({ triggerProps }) => (
            <IconButton icon={Plus} label="Insert" onMouseDown={keepEditorFocus} {...triggerProps} />
          )}
        </InsertMenu>
      ) : null}

      <span className="note-header__spacer" />

      <SaveIndicator noteId={row.localId} />

      {people.length > 0 ? <AvatarStack people={people} /> : null}

      {canShare(row.role) ? (
        <Button
          variant="secondary"
          // Until the Share modal is rebuilt, Share opens the existing page, which needs the server id.
          disabled={empty || row.serverId === null}
          onMouseDown={keepEditorFocus}
          onClick={() => {
            if (row.serverId !== null) void navigate(ROUTES.legacy.noteShare(row.serverId));
          }}
        >
          Share
        </Button>
      ) : null}

      {more ? (
        <ContextMenu
          role={row.role}
          where="editor"
          pinned={more.pinned}
          archived={more.archived}
          onPin={more.onPin}
          onCopyText={more.onCopyText}
          onMakeCopy={more.onMakeCopy}
          onArchive={more.onArchive}
          onDelete={more.onDelete}
        >
          {({ triggerProps }) => (
            <IconButton icon={Ellipsis} label="More" onMouseDown={keepEditorFocus} {...triggerProps} />
          )}
        </ContextMenu>
      ) : null}
    </div>
  );
}
