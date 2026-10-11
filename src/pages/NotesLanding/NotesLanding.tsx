import { Pen } from 'lucide-react';

import { useStartNote } from '@/app/shell/useStartNote';
import { Button, EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './NotesLanding.css';

/**
 * `/notes` with no note chosen. Only seen on two panes (O-13); on a phone this
 * pane is hidden and the list shows. It no longer jumps to the first note.
 */
export function NotesLandingPage() {
  useDocumentTitle(LIST_COPY.titles.all);
  const startNote = useStartNote();

  return (
    <div className="notes-landing">
      <EmptyState
        icon={Pen}
        title={LIST_COPY.empty.detail.title}
        description={LIST_COPY.empty.detail.description}
        action={
          <Button variant="primary" onClick={startNote}>
            {LIST_COPY.empty.newNote}
          </Button>
        }
      />
    </div>
  );
}
