import { ArrowLeft, Ellipsis, Plus, Share } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { AvatarStack, ContextMenu, IconButton, InsertMenu } from '@/design-system/ui';
import type { CollabState } from '@/features/collab/CollabProvider';
import { PresenceAvatars } from '@/features/collab/PresenceAvatars';
import { ShareModal } from '@/features/collab/ShareModal/ShareModal';
import type { PresentPerson } from '@/features/collab/usePresencePeople';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import type { EditorMoreActions } from '@/features/editor/hooks/useEditorActions';
import { discardDraft } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { canEdit, canShare } from '@/features/notes/permissions';
import { LeaveNoteModal } from '@/pages/Home/LeaveNoteModal';
import { useBarSlot, useTwoPane } from '@/shared/hooks/useBarSlot';
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
  /** The live channel's state, for the status word (step 16c). */
  collab?: CollabState | undefined;
  /** The other people in the note right now (step 16e). */
  presence?: readonly PresentPerson[] | undefined;
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
  collab,
  presence = [],
}: NoteEditorHeaderProps) {
  const navigate = useNavigate();
  // On a wide screen the controls live in the shell bar, on the same line as the menu and bell.
  const barSlot = useBarSlot();
  const twoPane = useTwoPane();
  const inBar = twoPane && barSlot !== null;
  const [shareOpen, setShareOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const clipCount =
    useLiveQuery(async () => clipRepository.countForNote(row.localId), [row.localId]) ?? 0;
  const empty = isEmptyNote({ content: row.content, clipCount });

  // Until someone is present, a shared note shows its owner.
  const people =
    row.role !== 'owner' && row.ownerName ? [{ name: row.ownerName, tint: 1 as const }] : [];

  const goBack = (): void => {
    // A blank draft is forgotten: no row, no server record, no toast (step 8d).
    discardDraft(row.localId);
    void navigate(ROUTES.notes());
  };

  const showInsert =
    canEdit(row.role) && (onInsertVoice !== undefined || onInsertChecklist !== undefined);

  const header = (
    <div className={inBar ? 'note-header note-header--in-bar' : 'note-header'}>
      <IconButton className="note-header__back" icon={ArrowLeft} label="Back" onClick={goBack} />

      {showInsert ? (
        <InsertMenu onVoice={onInsertVoice} onChecklist={onInsertChecklist}>
          {({ triggerProps }) => (
            <IconButton
              className="note-header__insert"
              icon={Plus}
              label="Insert"
              onMouseDown={keepEditorFocus}
              {...triggerProps}
            />
          )}
        </InsertMenu>
      ) : null}

      <span className="note-header__spacer" />

      <SaveIndicator noteId={row.localId} role={row.role} collab={collab} />

      {presence.length > 0 ? (
        <PresenceAvatars people={presence} />
      ) : people.length > 0 ? (
        <AvatarStack people={people} />
      ) : null}

      {canShare(row.role) ? (
        <>
          <IconButton
            icon={Share}
            label="Share note"
            title="Share note"
            // Sharing needs the note on the server, so Share waits for its server id.
            disabled={empty || row.serverId === null}
            onMouseDown={keepEditorFocus}
            onClick={() => {
              setShareOpen(true);
            }}
          />
          {row.serverId !== null ? (
            <ShareModal
              noteId={row.serverId}
              open={shareOpen}
              onClose={() => {
                setShareOpen(false);
              }}
            />
          ) : null}
        </>
      ) : null}

      {more && !inBar ? (
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
          onLeave={
            more.onLeave
              ? () => {
                  setLeaveOpen(true);
                }
              : undefined
          }
        >
          {({ triggerProps }) => (
            <IconButton
              icon={Ellipsis}
              label="More"
              onMouseDown={keepEditorFocus}
              {...triggerProps}
            />
          )}
        </ContextMenu>
      ) : null}

      {more?.onLeave ? (
        <LeaveNoteModal
          title={deriveNoteLabel(row.content).label}
          ownerName={row.ownerName ?? null}
          open={leaveOpen}
          onCancel={() => {
            setLeaveOpen(false);
          }}
          onConfirm={() => {
            setLeaveOpen(false);
            more.onLeave?.();
          }}
        />
      ) : null}
    </div>
  );

  return inBar ? createPortal(header, barSlot) : header;
}
