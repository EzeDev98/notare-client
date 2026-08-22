import type { SaveState } from '@/features/editor/saveState';
import './SaveIndicator.css';

/**
 * The visible text for a save state — ONLY for the states worth a person's
 * attention. `unsaved` / `saving` / `saved` are routine progress, not
 * signal: narrating every debounce cycle ("Unsaved changes" → "Saving…" →
 * "Saved", on repeat, for as long as someone is typing) is chrome nobody
 * asked to keep reading, and it was pushing the note's own first line down
 * to make room for it. The save itself still runs exactly the same either
 * way — this only decides what gets narrated.
 */
function describe(state: SaveState): { label: string; tone: 'warn' | 'danger' } | null {
  switch (state.status) {
    case 'idle':
    case 'unsaved':
    case 'saving':
    case 'saved':
      return null;
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

/**
 * The inline save status.
 *
 * §38: never a toast, and not even a quiet line of routine text either —
 * only offline / a failed save / a conflict actually need a person to DO
 * something (go back online, retry, resolve it), so those are the only
 * states that render at all. Nothing renders — not even a hidden
 * placeholder — for the routine states, so this element reserves no
 * layout space until there is genuinely something worth attention.
 *
 * Visible and announced are the SAME set now, which is simpler than it
 * used to be: previously the visible text covered every state (aria-hidden
 * from screen readers) while a separate live region announced only
 * problems. Now that routine states show nothing at all, there is no
 * longer a gap between what's on screen and what a screen reader hears.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  const described = describe(state);

  return (
    <>
      {described ? (
        <p className="save-indicator" data-tone={described.tone}>
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
        {described ? described.label : ''}
      </p>
    </>
  );
}