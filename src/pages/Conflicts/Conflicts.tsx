import { useAuth } from '@/app/providers/auth-context';
import { Button } from '@/design-system/components/Button/Button';
import { useConflicts } from '@/features/notes/hooks/useConflicts';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Conflicts.css';

/**
 * Where a COLD-START conflict finally has somewhere to go (8E).
 *
 * `ConflictPanel` (features/editor) handles a 409 while the editor is open.
 * This is the other case the gap analysis named directly: a push (8C) or a
 * pull (8D) can mark `syncState: 'conflict'` on a note nobody is looking
 * at, and until this screen existed there was nothing that showed it —
 * conflicted rows just sat in Dexie, excluded from every future push
 * (push.ts's guard), invisible.
 *
 * Same three actions, same wording, same "keep both is primary" argument as
 * ConflictPanel — deliberately. A user should not be able to tell which
 * door they resolved a conflict through.
 */
export function ConflictsPage() {
  useDocumentTitle('Conflicts');

  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const { conflicts, keepMine, takeTheirs, keepBoth } = useConflicts(ownerId);

  return (
    <section className="conflicts">
      <h1>Conflicts</h1>
      <p className="conflicts__lead">
        These notes changed on the server while you had edits that hadn&rsquo;t been sent yet.
        Nothing has been lost — choose what to keep for each one.
      </p>

      {/*
        `conflicts === undefined` is Dexie not having answered yet —
        milliseconds, and a spinner for it flashes on every mount. An empty
        ARRAY means there genuinely are no conflicts right now.
      */}
      {conflicts !== undefined && conflicts.length === 0 ? (
        <div className="conflicts__centre">
          <p>No conflicts. Everything is in sync.</p>
        </div>
      ) : null}

      {conflicts !== undefined && conflicts.length > 0 ? (
        <ul className="conflicts__list" role="list">
          {conflicts.map(({ note, theirs }) => {
            const mineTitle = note.title.trim() === '' ? 'Untitled' : note.title;
            const theirTitle = (theirs.title ?? '').trim() === '' ? 'Untitled' : theirs.title;

            return (
              <li className="conflicts__item" key={note.localId}>
                <h2 className="conflicts__item-heading">{mineTitle}</h2>

                <div className="conflicts__panes">
                  <article className="conflicts__pane">
                    <h3 className="conflicts__pane-title">Your version</h3>
                    <p className="conflicts__title">{mineTitle}</p>
                    <div className="conflicts__body">{note.content}</div>
                  </article>

                  <article className="conflicts__pane">
                    <h3 className="conflicts__pane-title">Version on the server</h3>
                    <p className="conflicts__title">{theirTitle}</p>
                    <div className="conflicts__body">{theirs.content ?? ''}</div>
                  </article>
                </div>

                <div className="conflicts__actions">
                  {/*
                    "Keep both" is primary — the only option that destroys
                    nothing, same argument as ConflictPanel.
                  */}
                  <Button variant="primary" onClick={() => void keepBoth(note.localId)}>
                    Keep both
                  </Button>
                  <Button variant="secondary" onClick={() => void keepMine(note.localId)}>
                    Keep mine
                  </Button>
                  <Button variant="secondary" onClick={() => void takeTheirs(note.localId)}>
                    Use theirs
                  </Button>
                </div>

                <p className="conflicts__note">
                  Keeping both puts the other version first, then a divider, then yours.
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
