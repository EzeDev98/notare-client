import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useAuth } from '@/app/providers/auth-context';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

/**
 * A note that does not exist yet.
 *
 * Nothing is created on arrival — clicking "New note" and changing your mind
 * should leave no trace. The POST happens on the first meaningful edit (6A),
 * which is also why creation has to be single-flight: between that keystroke
 * and the response there is no id, and a second save would create a SECOND
 * NOTE holding half the user's words.
 */
export function NewNotePage() {
  useDocumentTitle('New note');

  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  return (
    <article className="note-detail">
      <NoteEditorHost note={null} currentUserId={currentUserId} />
    </article>
  );
}
