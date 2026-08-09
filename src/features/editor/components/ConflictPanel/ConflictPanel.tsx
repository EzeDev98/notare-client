import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import type { ConflictState } from '@/features/editor/hooks/useConflict';
import type { Draft } from '@/features/editor/hooks/useNoteDraft';
import './ConflictPanel.css';

interface ConflictPanelProps {
  conflict: ConflictState;
  mine: Draft;
  /** True when the other edit came from this user on another device. */
  byAnotherDevice: boolean;
  onKeepMine: () => void;
  onUseTheirs: () => void;
  onKeepBoth: () => void;
}

/**
 * Conflict resolution as a PRODUCT FEATURE, not an error message (§20).
 *
 * Rendered IN PLACE of the editor surface rather than at a /conflict route.
 * A route would unmount the editor, and 6D's key means that discards the draft
 * — the user's unsaved words are the very thing the conflict is about.
 * Navigating to resolve it would destroy one side of it. That is a deliberate
 * deviation from the screen inventory in §4.1.
 *
 * THREE OPTIONS AND NO DEFAULT. §20 forbids the client choosing a side, and
 * the first two are both destructive: "keep mine" loses their words, "use
 * theirs" loses mine. "Keep both" exists because a user under pressure will
 * click something, and it is never wrong — only untidy, which is recoverable.
 */
export function ConflictPanel({
  conflict,
  mine,
  byAnotherDevice,
  onKeepMine,
  onUseTheirs,
  onKeepBoth,
}: ConflictPanelProps) {
  if (conflict.status === 'loading') {
    return (
      <div className="conflict conflict--centre">
        <Spinner label="Loading the other version" />
      </div>
    );
  }

  if (conflict.status === 'error') {
    return (
      <div className="conflict conflict--centre" role="alert">
        <p>
          This note was changed elsewhere, and the other version could not be loaded. Your changes
          are still here and have not been saved.
        </p>
      </div>
    );
  }

  if (conflict.status !== 'ready') return null;

  const theirs = conflict.theirs;

  return (
    <section className="conflict" aria-labelledby="conflict-heading">
      {/*
        role="alert" so this is announced immediately — unlike the save
        indicator, which stays quiet for nominal progress. A conflict is
        exactly the interruption §38 reserves announcements for.
      */}
      <div role="alert">
        <h2 className="conflict__heading" id="conflict-heading">
          This note was edited{byAnotherDevice ? ' on another device' : ' by someone else'}
        </h2>
        <p className="conflict__lead">
          Your changes have not been saved. Choose what to keep — nothing is lost until you decide.
        </p>
      </div>

      <div className="conflict__panes">
        <article className="conflict__pane">
          <h3 className="conflict__pane-title">Your version</h3>
          {/* pre-wrap, matching the read view: the text is text, and newlines
              are preserved by CSS rather than by markup. */}
          <p className="conflict__title">{mine.title.trim() === '' ? 'Untitled' : mine.title}</p>
          <div className="conflict__body">{mine.content}</div>
        </article>

        <article className="conflict__pane">
          <h3 className="conflict__pane-title">
            {byAnotherDevice ? 'Version on the server' : 'Their version'}
          </h3>
          <p className="conflict__title">
            {(theirs.title ?? '').trim() === '' ? 'Untitled' : theirs.title}
          </p>
          <div className="conflict__body">{theirs.content ?? ''}</div>
        </article>
      </div>

      <div className="conflict__actions">
        {/*
          "Keep both" is primary, and that is the whole argument of this
          screen. It is the only option that destroys nothing — the other two
          are one click away from losing somebody's words, and a person
          interrupted mid-sentence will click the emphasised button.
        */}
        <Button variant="primary" onClick={onKeepBoth}>
          Keep both
        </Button>
        <Button variant="secondary" onClick={onKeepMine}>
          Keep mine
        </Button>
        <Button variant="secondary" onClick={onUseTheirs}>
          Use theirs
        </Button>
      </div>

      <p className="conflict__note">
        Keeping both puts the other version first, then a divider, then yours.
      </p>
    </section>
  );
}
