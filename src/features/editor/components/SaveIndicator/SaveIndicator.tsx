import type { SaveState } from '@/features/editor/saveState';

/**
 * Intentionally renders nothing visible for any save state.
 *
 * Saving is a background concern. Local edits are already safe in IndexedDB
 * and the server copy catches up on its own, so no status line is shown for
 * progress, offline or a failed attempt. Any in-flow text here inserts a line
 * above the note and shoves the writing surface (and the mic) around each
 * time it appears or clears.
 *
 * The one state that needs a person is a conflict, and ConflictPanel renders
 * that as its own full panel, so it does not need this component.
 *
 * Kept as a component (rather than deleting the call sites) so a future
 * non-layout signal, for example a dot in the toolbar, has one place to live.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  void state;
  return null;
}
