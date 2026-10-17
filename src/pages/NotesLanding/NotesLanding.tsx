import { Pen } from 'lucide-react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { useStartNote } from '@/app/shell/useStartNote';
import { Button, EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './NotesLanding.css';

/**
 * The note pane: what shows when no note is open (`/notes`). Only seen on two panes (O-13); on a phone
 * this pane is hidden and the list shows. With no notes at all it carries the
 * icon, the text and the New note button; the list beside it says only "No notes yet".
 */
function OwnerLanding({ ownerId }: { ownerId: number }) {
  const startNote = useStartNote();
  const items = useNoteList('all', ownerId, '');

  // Dexie has not answered yet: show nothing rather than the wrong state.
  if (items === undefined) return null;

  const newNote = (
    <Button variant="primary" onClick={startNote}>
      {LIST_COPY.empty.newNote}
    </Button>
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pen}
        title={LIST_COPY.empty.all.title}
        description={LIST_COPY.empty.all.description}
        action={newNote}
      />
    );
  }

  return (
    <EmptyState
      icon={Pen}
      title={LIST_COPY.empty.detail.title}
      description={LIST_COPY.empty.detail.description}
      action={newNote}
    />
  );
}

export function NotesLandingPage() {
  useDocumentTitle(LIST_COPY.titles.all);
  const user = useSessionUser();

  return <div className="notes-landing">{user ? <OwnerLanding ownerId={user.id} /> : null}</div>;
}
