import { ArrowLeft, Ellipsis } from 'lucide-react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { ContextMenu, IconButton } from '@/design-system/ui';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import type { EditorMoreActions } from '@/features/editor/hooks/useEditorActions';
import { discardDraft } from '@/features/notes/createNote';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { useBarSlot, useTwoPane } from '@/shared/hooks/useBarSlot';

import './NoteEditorHeader.css';

interface NoteEditorHeaderProps {
  /** The note on screen (live). */
  row: NoteRow;
  /** The more menu (step 12e). The button is drawn only when given. */
  more?: EditorMoreActions | undefined;
}

/** Keeps the caret (and the phone keyboard) in the note when a header button is pressed. */
function keepEditorFocus(event: MouseEvent): void {
  event.preventDefault();
}

/**
 * The editor header, 56px (master 6.4, step 12d). Left to right: Back (phone
 * only), spacer, status, more.
 */
export function NoteEditorHeader({ row, more }: NoteEditorHeaderProps) {
  const navigate = useNavigate();
  // On a wide screen the controls live in the shell bar, on the same line as the menu and bell.
  const barSlot = useBarSlot();
  const twoPane = useTwoPane();
  const inBar = twoPane && barSlot !== null;
  const goBack = (): void => {
    // A blank draft is forgotten: no row, no server record, no toast (step 8d).
    discardDraft(row.localId);
    void navigate(ROUTES.notes());
  };

  const header = (
    <div className={inBar ? 'note-header note-header--in-bar' : 'note-header'}>
      <IconButton className="note-header__back" icon={ArrowLeft} label="Back" onClick={goBack} />

      <span className="note-header__spacer" />

      <SaveIndicator noteId={row.localId} />

      {more && !inBar ? (
        <ContextMenu
          where="editor"
          pinned={more.pinned}
          onPin={more.onPin}
          onCopyText={more.onCopyText}
          onMakeCopy={more.onMakeCopy}
          onRestoreOriginal={more.onRestoreOriginal}
          onDelete={more.onDelete}
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
    </div>
  );

  return inBar ? createPortal(header, barSlot) : header;
}
