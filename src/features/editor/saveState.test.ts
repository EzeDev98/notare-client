import { describe, expect, it } from 'vitest';

import { initialSaveState, saveReducer, type SaveState } from '@/features/editor/saveState';

describe('the ordinary cycle', () => {
  it('goes idle → unsaved → saving → saved', () => {
    let state = initialSaveState;
    expect(state).toEqual({ status: 'idle' });

    state = saveReducer(state, { type: 'EDITED' });
    expect(state).toEqual({ status: 'unsaved' });

    state = saveReducer(state, { type: 'SAVE_STARTED' });
    expect(state).toEqual({ status: 'saving', supersededByEdits: false });

    state = saveReducer(state, { type: 'SAVE_SUCCEEDED' });
    expect(state).toEqual({ status: 'saved' });
  });
});

describe('editing while a save is in flight', () => {
  it('does not report "saved" over text that was never sent', () => {
    /*
     * THE CASE THIS WHOLE MACHINE EXISTS FOR.
     *
     * A request carrying "hello" is in flight; the user types " world"; the
     * request succeeds. Going to `saved` would show "Saved" over unsaved text
     * — the worst lie an auto-save indicator can tell, because its entire
     * purpose is that the user trusts it instead of reaching for Ctrl-S.
     */
    let state: SaveState = { status: 'saving', supersededByEdits: false };

    state = saveReducer(state, { type: 'EDITED' });
    expect(state).toEqual({ status: 'saving', supersededByEdits: true });

    state = saveReducer(state, { type: 'SAVE_SUCCEEDED' });
    expect(state).toEqual({ status: 'unsaved' });
  });
});

describe('offline', () => {
  it('remembers whether anything was pending', () => {
    const offline = saveReducer({ status: 'unsaved' }, { type: 'WENT_OFFLINE' });
    expect(offline).toEqual({ status: 'offline', hasUnsavedChanges: true });

    // Coming back online must not claim "Saved" when nothing was sent.
    expect(saveReducer(offline, { type: 'WENT_ONLINE' })).toEqual({ status: 'unsaved' });
  });

  it('returns to saved when nothing was pending', () => {
    const offline = saveReducer({ status: 'saved' }, { type: 'WENT_OFFLINE' });
    expect(offline).toEqual({ status: 'offline', hasUnsavedChanges: false });
    expect(saveReducer(offline, { type: 'WENT_ONLINE' })).toEqual({ status: 'saved' });
  });

  it('records edits made while offline', () => {
    const offline: SaveState = { status: 'offline', hasUnsavedChanges: false };
    expect(saveReducer(offline, { type: 'EDITED' })).toEqual({
      status: 'offline',
      hasUnsavedChanges: true,
    });
  });
});

describe('totality', () => {
  it('produces a state for every action from every state', () => {
    const states: SaveState[] = [
      { status: 'idle' },
      { status: 'unsaved' },
      { status: 'saving', supersededByEdits: false },
      { status: 'saving', supersededByEdits: true },
      { status: 'saved' },
      { status: 'offline', hasUnsavedChanges: true },
      { status: 'error', retryable: true },
    ];

    const actions = [
      { type: 'EDITED' },
      { type: 'SAVE_STARTED' },
      { type: 'SAVE_SUCCEEDED' },
      { type: 'SAVE_FAILED', retryable: true },
      { type: 'WENT_OFFLINE' },
      { type: 'WENT_ONLINE' },
    ] as const;

    // 64 combinations, none of which may throw. A reducer that throws on an
    // "impossible" transition turns a race into a crash.
    for (const state of states) {
      for (const action of actions) {
        expect(() => saveReducer(state, action)).not.toThrow();
      }
    }
  });
});
