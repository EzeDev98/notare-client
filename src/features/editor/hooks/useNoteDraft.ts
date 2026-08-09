import { useCallback, useRef, useState } from 'react';

import type { NoteResponse } from '@/features/notes/types';

/**
 * What the user is currently typing.
 *
 * Draft fields are always STRINGS, never null. The server distinguishes them —
 * null on PUT clears a field, an omitted field on PATCH leaves it unchanged —
 * and letting that distinction into the draft means every consumer has to
 * remember it. The mapping to the wire happens in exactly one place
 * (toSavePayload), so the dangerous case is thought about once.
 */
export interface Draft {
  title: string;
  content: string;
}

export interface DraftState {
  draft: Draft;
  /** What the server last confirmed. Used to decide whether a save is needed. */
  saved: Draft;
  /**
   * The optimistic-locking token, ECHOED and never incremented.
   *
   * Null while a new note has not been created yet. Every server response
   * replaces it — including from pin and archive, which bump @Version without
   * touching text (B5).
   */
  version: number | null;
  /** Null until a new note has been created server-side. */
  noteId: number | null;
}

function toDraft(note: NoteResponse): Draft {
  return { title: note.title ?? '', content: note.content ?? '' };
}

export function useNoteDraft(initial: NoteResponse | null) {
  const [state, setState] = useState<DraftState>(() => ({
    draft: initial ? toDraft(initial) : { title: '', content: '' },
    saved: initial ? toDraft(initial) : { title: '', content: '' },
    version: initial?.version ?? null,
    noteId: initial?.id ?? null,
  }));

  /*
   * A ref MIRRORING the state, so the save scheduler in 6C can read the latest
   * draft without being recreated on every keystroke.
   *
   * This is the ref-as-instance-variable use, not ref-as-DOM-handle. A
   * debounced callback closes over whatever it captured when it was created;
   * without this it would save the text as it was when the timer started
   * rather than when it fired — which is the stale-closure bug, and it is
   * invisible until someone types fast.
   */
  const stateRef = useRef(state);

  /*
   * NO unconditional `stateRef.current = state` here.
   *
   * That line looks harmless and undoes every synchronous write: applyNow sets
   * the ref and queues a setState, React re-renders with the PREVIOUS state in
   * scope, and the assignment resets the ref to it. The synchronous value
   * survives exactly until the next render — which is precisely when a flush
   * in the same tick reads it.
   *
   * setState is the only writer of `state`, and applyNow updates the ref at
   * the same moment it queues that update, so the ref is never behind. The
   * only case needing a sync-back is an external reset, which remounts the
   * component (6D's key) and re-runs the initialiser anyway.
   */

  /*
   * Applies a change to BOTH the state and the ref, synchronously.
   *
   * The ref is normally a mirror updated on render, which is enough for the
   * debounced scheduler — by the time a timer fires, the render has happened.
   *
   * It is NOT enough for conflict resolution, which mutates and then flushes
   * in the same tick: setState is asynchronous, so save() would read the ref
   * as it was BEFORE the resolution and send the stale version — getting
   * another 409 and bouncing the user straight back to the conflict panel.
   */
  const applyNow = useCallback((update: (current: DraftState) => DraftState) => {
    stateRef.current = update(stateRef.current);
    setState(stateRef.current);
  }, []);

  const setDraft = useCallback(
    (changes: Partial<Draft>) => {
      applyNow((current) => ({ ...current, draft: { ...current.draft, ...changes } }));
    },
    [applyNow],
  );

  /**
   * Applies a server response.
   *
   * `saved` moves to what the server now holds, and `version` is ADOPTED.
   * Never `version + 1` — the client quotes the token, it does not count.
   *
   * The DRAFT is deliberately untouched. The user may have typed more while
   * the request was in flight, and overwriting their text with the server's
   * echo of an older save is the single worst thing an editor can do.
   */
  const acceptSaved = useCallback(
    (note: NoteResponse) => {
      // applyNow, like every other mutator: with the render-time mirror gone,
      // a direct setState would leave the ref holding the pre-save version —
      // and the next save would send it and 409 against a note nobody else
      // touched.
      applyNow((current) => ({
        ...current,
        saved: toDraft(note),
        version: note.version,
        noteId: note.id,
      }));
    },
    [applyNow],
  );

  /**
   * Takes the server's version WITHOUT touching the draft.
   *
   * "Keep mine" during a conflict: the user's text is deliberately kept, and
   * the version is swapped for the server's so the next save is accepted
   * rather than rejected as stale. That is a deliberate overwrite the user
   * chose — which is exactly why it needs its own named operation rather than
   * being a side effect of something else.
   */
  const adoptVersion = useCallback(
    (version: number) => {
      // applyNow, not setState: a flush in the same tick must see this.
      applyNow((current) => ({ ...current, version }));
    },
    [applyNow],
  );

  /** Replaces everything — conflict resolution taking the server's copy (6E). */
  const replaceWith = useCallback(
    (note: NoteResponse) => {
      applyNow(() => ({
        draft: toDraft(note),
        saved: toDraft(note),
        version: note.version,
        noteId: note.id,
      }));
    },
    [applyNow],
  );

  const isDirty =
    state.draft.title !== state.saved.title || state.draft.content !== state.saved.content;

  return { state, stateRef, setDraft, acceptSaved, adoptVersion, replaceWith, isDirty };
}

/**
 * The PATCH body for a draft.
 *
 * Only CHANGED fields are sent — that is what PATCH means here, and sending an
 * unchanged field is not merely wasteful: it widens the window in which a
 * concurrent edit to that field gets overwritten.
 *
 * A cleared field goes as an EMPTY STRING, never null. Null is PUT's verb for
 * "clear this", and on PATCH the server would... not receive it at all, since
 * JSON.stringify drops undefined and null means something different again.
 * Empty string is unambiguous in both directions.
 */
export function toSavePayload(state: DraftState): { title?: string; content?: string } {
  const payload: { title?: string; content?: string } = {};
  if (state.draft.title !== state.saved.title) payload.title = state.draft.title;
  if (state.draft.content !== state.saved.content) payload.content = state.draft.content;
  return payload;
}
