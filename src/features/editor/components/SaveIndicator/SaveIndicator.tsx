import type { SaveState } from '@/features/editor/saveState';
import './SaveIndicator.css';

/** The visible text for each state, and whether it is worth announcing. */
function describe(state: SaveState): { label: string; tone: 'quiet' | 'warn' | 'danger' } | null {
  switch (state.status) {
    case 'idle':
      // NOTHING. An untouched note has no save status, and showing one would
      // be chrome competing with the content before anything has happened.
      return null;
    case 'unsaved':
      return { label: 'Unsaved changes', tone: 'quiet' };
    case 'saving':
      return { label: 'Saving…', tone: 'quiet' };
    case 'saved':
      return { label: 'Saved', tone: 'quiet' };
    case 'offline':
      return { label: 'Offline — changes not saved yet', tone: 'warn' };
    case 'error':
      return { label: 'Could not save', tone: 'danger' };
    case 'conflict':
      return { label: 'Someone else edited this note', tone: 'danger' };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

/** Only non-nominal states are worth interrupting a screen reader for. */
function shouldAnnounce(state: SaveState): boolean {
  return state.status === 'offline' || state.status === 'error' || state.status === 'conflict';
}

/**
 * The inline save status.
 *
 * §38: never a toast. "Note saved!" three times a minute is the canonical
 * example of a notification nobody asked for — this is a quiet line of text
 * that the user can look at when they want reassurance and ignore otherwise.
 *
 * THE ACCESSIBILITY DECISION IS THE INTERESTING ONE. The obvious move is
 * role="status" on the whole thing, which announces "Saving… Saved" on EVERY
 * debounce cycle — a screen reader user typing a paragraph hears it a dozen
 * times.
 *
 * So the visible text is aria-hidden, and a separate polite live region
 * announces only problems: offline, error, conflict. Nominal progress is
 * silent, which is §38's principle applied to the audio channel rather than
 * the visual one.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  const described = describe(state);

  return (
    <>
      {described ? (
        <p className="save-indicator" data-tone={described.tone} aria-hidden="true">
          {described.label}
        </p>
      ) : null}

      {/*
        Always rendered, so the live region exists in the DOM before it has
        content. A region added at the same moment as its text is frequently
        not announced at all — the screen reader has nothing to have been
        watching.
      */}
      <p className="ds-visually-hidden" role="status">
        {described && shouldAnnounce(state) ? described.label : ''}
      </p>
    </>
  );
}
