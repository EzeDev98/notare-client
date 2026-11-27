/** The note pane when no note is open. */
import { Pen } from 'lucide-react';
import { Navigate } from 'react-router';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { useStartNote } from '@/app/shell/useStartNote';
import { Button, EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { useTwoPane } from '@/shared/hooks/useBarSlot';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './NotesLanding.css';

function OwnerLanding({ ownerId }: { ownerId: number }) {
  const startNote = useStartNote();
  const items = useNoteList(ownerId, '');
  const twoPane = useTwoPane();

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

  const first = items[0];
  if (twoPane && first) return <Navigate to={first.path} replace />;

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
  useDocumentTitle(LIST_COPY.title);
  const user = useSessionUser();

  return <div className="notes-landing">{user ? <OwnerLanding ownerId={user.id} /> : null}</div>;
}
