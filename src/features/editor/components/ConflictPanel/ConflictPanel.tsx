import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import type { ConflictState } from '@/features/editor/hooks/useConflict';
import { ConflictContentPreview } from './ConflictContentPreview';
import './ConflictPanel.css';

/**
 * The user's unsaved side of a conflict.
 *
 * Declared HERE rather than imported, because 7C deleted useNoteDraft — the
 * draft now lives in Dexie and the editor reads it from the row. This panel
 * needs the field it displays and nothing else, so a local type is honest:
 * it no longer depends on how the draft is held, only on what it is.
 *
 * No `title` — 1B/4D: the note domain has none, so there is nothing left
 * to label each pane with beyond its own full content below.
 */
interface ConflictSide {
  content: string;
}

interface ConflictPanelProps {
  conflict: ConflictState;
  mine: ConflictSide;
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
          {/* Rendered through ConflictContentPreview — real Markdown
              formatting, not the raw `#`/`**` characters this used to show
              verbatim. No separate title line above this (1B/4D) — it would
              just repeat the content's own first line. */}
          <div className="conflict__body">
            <ConflictContentPreview content={mine.content} />
          </div>
        </article>

        <article className="conflict__pane">
          <h3 className="conflict__pane-title">
            {byAnotherDevice ? 'Version on the server' : 'Their version'}
          </h3>
          <div className="conflict__body">
            <ConflictContentPreview content={theirs.content ?? ''} />
          </div>
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
