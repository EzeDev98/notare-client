/**
 * Every state a save can be in.
 *
 * A union rather than isSaving + isDirty + hasError. Those three booleans
 * describe eight combinations, several of which are nonsense, and — more
 * importantly — none of them force you to think about the one case that
 * matters. See `saving.supersededByEdits` below.
 */
export type SaveState =
  /** Opened and untouched. No indicator at all — nothing has happened. */
  | { status: 'idle' }

  /** Edited, not yet sent. The debounce in 6C is running. */
  | { status: 'unsaved' }
  | {
      status: 'saving';
      /**
       * THE FLAG THAT MAKES THIS A MACHINE.
       *
       * True when the user typed AFTER this request went out. Without it, a
       * successful save transitions to `saved` while the screen shows text
       * that has not been sent — the indicator saying "Saved" over unsaved
       * words.
       *
       * That is the worst lie this component can tell, because the entire
       * point of an auto-save indicator is that the user trusts it instead of
       * reaching for Ctrl-S.
       */
      supersededByEdits: boolean;
    }

  /** Everything on screen is on the server. */
  | { status: 'saved' }

  /**
   * No connection. Step 8 queues these; for now it is an honest "not saved
   * yet" rather than a failure, because the user has done nothing wrong.
   */
  | { status: 'offline'; hasUnsavedChanges: boolean }

  /** A save failed for a reason a retry might fix. */
  | { status: 'error'; retryable: boolean };

export type SaveAction =
  | { type: 'EDITED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; retryable: boolean }
  | { type: 'WENT_OFFLINE' }
  | { type: 'WENT_ONLINE' };

export const initialSaveState: SaveState = { status: 'idle' };

/** True when there is work the scheduler still needs to do. */
export function hasPendingWork(state: SaveState): boolean {
  switch (state.status) {
    case 'unsaved':
    case 'error':
      return true;
    case 'saving':
      return state.supersededByEdits;
    case 'offline':
      return state.hasUnsavedChanges;
    case 'idle':
    case 'saved':
      return false;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

/**
 * TOTAL: every (state, action) pair produces a state.
 *
 * Impossible transitions return the current state rather than throwing — a
 * SAVE_SUCCEEDED arriving after a conflict was detected is a race, not a bug,
 * and throwing would turn a benign ordering into a crash.
 */
export function saveReducer(state: SaveState, action: SaveAction): SaveState {
  switch (action.type) {
    case 'EDITED':
      if (state.status === 'saving') {
        // Records that the in-flight request no longer carries everything.
        return { status: 'saving', supersededByEdits: true };
      }
      if (state.status === 'offline') {
        return { status: 'offline', hasUnsavedChanges: true };
      }
      return { status: 'unsaved' };

    case 'SAVE_STARTED':
      if (state.status === 'offline') return state;
      return { status: 'saving', supersededByEdits: false };

    case 'SAVE_SUCCEEDED':
      if (state.status !== 'saving') {
        // Arrived after a conflict, an offline transition, or a reset. The
        // newer state wins.
        return state;
      }
      // The whole reason the flag exists: more was typed while this was in
      // flight, so "Saved" would be false.
      return state.supersededByEdits ? { status: 'unsaved' } : { status: 'saved' };

    case 'SAVE_FAILED':
      return { status: 'error', retryable: action.retryable };

    case 'WENT_OFFLINE':
      return { status: 'offline', hasUnsavedChanges: hasPendingWork(state) };

    case 'WENT_ONLINE':
      if (state.status !== 'offline') return state;
      return state.hasUnsavedChanges ? { status: 'unsaved' } : { status: 'saved' };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
