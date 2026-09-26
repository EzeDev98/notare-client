import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { SidebarNoteItem } from '@/features/notes/components/SidebarNoteItem/SidebarNoteItem';
import './AnimatedSidebarNoteList.css';

/*
 * 640ms + cubic-bezier(0.4, 0, 0.2, 1) (Material's "standard" curve),
 * not the old 440ms + cubic-bezier(0.22, 1, 0.36, 1). That old curve's
 * two Y control points both sit at 1 — nearly all of the movement lands
 * in roughly the first third of the timeline, with the rest spent
 * barely creeping the last few percent home. At 440ms that reads as a
 * flash-then-settle snap, not the gentle, evenly-paced push/pull the
 * reference app (Apple Notes) has. This curve eases in AND out, so the
 * row's motion is visible for the animation's full length instead of
 * being front-loaded into its opening frames.
 *
 * MUST stay in lockstep with the literal 440ms/easing values hardcoded
 * in AnimatedSidebarNoteList.css's own `.sidebar-note-item--exit`
 * layout rule's neighboring comments (CSS can't read a JS constant) —
 * this is also the duration this file's own cleanup timers wait before
 * clearing an enter/exit row's animationState.
 */
const ANIMATION_MS = 640;
const ANIMATION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

/*
 * All three of this list's motions (a resting row's FLIP reposition,
 * an entering row's own fade+slide, an exiting row's own fade+slide)
 * are driven through safeAnimate(element, ) (below) rather than a
 * declarative CSS `animation`, precisely so this one check covers all
 * three evenly. reset.css's own global `prefers-reduced-motion: reduce`
 * block forces every CSS `@keyframes` animation's duration to ~0 —
 * exactly right for accessibility, but it has zero power over
 * safeAnimate(element, ) calls, so a split between the two systems would
 * silently miss whichever half runs through JS. Checked fresh on every
 * call rather than cached, since it can change mid-session (the OS
 * setting, not just the page load).
 */
/** Skips the animation where the browser (or a test DOM) has no Web Animations API. */
function safeAnimate(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void {
  if (typeof element.animate !== 'function') return;
  element.animate(keyframes, options);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface AnimatedSidebarNoteListProps {
  notes: NoteView[];
  /** Which note the route currently matches, local or server — see
   * SidebarNoteItem's own comment on why these are threaded down rather
   * than left to NavLink's built-in route matching. */
  activeLocalId: string | null;
  activeNoteId: string | null;
  /** Set only during a pending note creation — see AppLayout's own
   * pendingActiveLocalId comment for why. */
  pendingActiveLocalId: string | null;
  /** Forwarded straight to every row — see SidebarNoteItem's own comment on
   * why one native event covers right-click, trackpad, and long-press
   * alike. */
  onNoteContextMenu: (note: NoteView, x: number, y: number) => void;
  /** The note whose context menu AppLayout currently has open, if any —
   * used only to add `isMenuOpen` to the one matching row. */
  contextMenuNoteLocalId: string | null;
}

/**
 * Whether ONE row should render as the currently-open note.
 *
 * `pendingActiveLocalId`, when set, overrides route-matching entirely: only
 * the note actually being created counts as active, full stop — not the
 * note the route still technically points at while its own navigate() is
 * deliberately held back (AppLayout's own NOTE_LIFECYCLE_DELAY_MS comment),
 * and not any other row either. Outside that window it falls back to the
 * ordinary "does this row's own route match the current one" check.
 */
function isRowActive(
  note: NoteView,
  activeLocalId: string | null,
  activeNoteId: string | null,
  pendingActiveLocalId: string | null,
): boolean {
  if (pendingActiveLocalId !== null) {
    return note.localId === pendingActiveLocalId;
  }

  return note.serverId === null
    ? note.localId === activeLocalId
    : String(note.serverId) === activeNoteId;
}

interface RenderedNote {
  note: NoteView;
  animationState?: 'enter' | 'exit';
  exitStyle?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | undefined;
}

export function AnimatedSidebarNoteList({
  notes,
  activeLocalId,
  activeNoteId,
  pendingActiveLocalId,
  onNoteContextMenu,
  contextMenuNoteLocalId,
}: AnimatedSidebarNoteListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * FLIP's "First": every row's on-screen top captured right before
   * `renderedNotes` changes, keyed by note id. Read back by the "play"
   * effect below once the new layout has committed.
   */
  const beforeTopsRef = useRef<Map<string, number>>(new Map());

  /*
   * Which ids are entering/exiting FOR THE FIRST TIME on this pass, and
   * whether this pass is a real add/remove at all (as opposed to an
   * unrelated re-render — a background sync refresh, a different note's
   * edit — that merely happens to fire while an earlier row is still
   * fading). This is the piece the old version was missing: it re-read
   * `renderedNotes` itself to decide what to animate, so ANY unrelated
   * update that touched `renderedNotes` re-ran the enter/exit
   * safeAnimate(element, ) calls for rows that were already mid-fade,
   * restarting them from frame 0 — which is exactly what produced a
   * neighbor that "travels slowly" (its FLIP animation kept restarting)
   * and a still-existing note fading to opacity 0 and staying there
   * (its exit animation kept restarting too, so the one clean 640ms
   * window it needed to finish and get removed from the list never
   * happened). Tracking "is this fresh" explicitly means an unrelated
   * re-render can no longer touch an animation that isn't its own.
   */
  const freshChangeRef = useRef<{
    entered: Set<string>;
    exited: Set<string>;
    isStructural: boolean;
  }>({ entered: new Set(), exited: new Set(), isStructural: false });

  /** One cleanup timer per row currently entering/exiting, keyed by note
   * id — not one shared timer for the whole list. A shared timer keyed
   * on `[renderedNotes]` gets pushed back out to a fresh `ANIMATION_MS`
   * every time ANYTHING else in the list changes, so a note that was
   * mid-exit when an unrelated update arrived could have its cleanup
   * deferred indefinitely — which is how a deleted note kept sitting in
   * the list, faded to invisible but never actually removed. */
  const exitTimersRef = useRef<Map<string, number>>(new Map());

  const [renderedNotes, setRenderedNotes] = useState<RenderedNote[]>(() =>
    notes.map((note) => ({ note })),
  );

  /*
   * Reconcile `notes` (the real data) into `renderedNotes` (what's on
   * screen). Any number of rows can be added or removed in a single
   * pass — no longer just "the first one" — and a row already fading
   * from an earlier pass is carried forward untouched rather than
   * re-evaluated, so it can't be mistaken for a fresh change.
   */
  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const previous = renderedNotes;

    /*
     * FLIP's "First" measurement, taken before anything below changes
     * the DOM. Every row currently rendered gets measured — harmless
     * for rows that turn out not to need it, and this is the only
     * moment the "before" position still exists to measure.
     */
    const beforeTops = new Map<string, number>();

    for (const item of previous) {
      const element = list.querySelector<HTMLElement>(
        '[data-sidebar-note-id="' + item.note.localId + '"]',
      );

      if (element) {
        beforeTops.set(item.note.localId, element.getBoundingClientRect().top);
      }
    }

    beforeTopsRef.current = beforeTops;

    /*
     * A row already fading out (animationState 'exit') is not a
     * candidate for being "removed again" — it already is being
     * removed. Comparing against only the settled (resting or
     * entering) rows is what stops an unrelated update from treating
     * an already-fading ghost as a brand new deletion.
     */
    const settled = previous.filter((item) => item.animationState !== 'exit');
    const settledIds = new Set(settled.map((item) => item.note.localId));
    const currentIds = new Set(notes.map((note) => note.localId));

    const added = notes.filter((note) => !settledIds.has(note.localId));
    const removedNow = settled.filter((item) => !currentIds.has(item.note.localId));
    const stillFading = previous.filter((item) => item.animationState === 'exit');

    freshChangeRef.current = {
      entered: new Set(added.map((note) => note.localId)),
      exited: new Set(removedNow.map((item) => item.note.localId)),
      isStructural: added.length > 0 || removedNow.length > 0,
    };

    if (added.length === 0 && removedNow.length === 0 && stillFading.length === 0) {
      // Ordinary content/order refresh — nothing entering, leaving, or
      // still fading from before.
      setRenderedNotes(notes.map((note) => ({ note })));
      return;
    }

    /*
     * DELETION MOTION:
     *
     * Each deleted row must stop occupying layout space immediately,
     * so the rows underneath can start moving before its own exit
     * animation finishes. Capture its exact position now — the ghost
     * will be pinned there via absolute positioning while the real
     * list reflows underneath it.
     */
    const removedExitStyles = new Map<string, RenderedNote['exitStyle']>();

    if (removedNow.length > 0) {
      const listRect = list.getBoundingClientRect();

      for (const removedItem of removedNow) {
        const element = list.querySelector<HTMLElement>(
          '[data-sidebar-note-id="' + removedItem.note.localId + '"]',
        );

        if (!element) continue;

        const rect = element.getBoundingClientRect();

        removedExitStyles.set(removedItem.note.localId, {
          top: rect.top - listRect.top + list.scrollTop,
          left: rect.left - listRect.left + list.scrollLeft,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    const addedIds = new Set(added.map((note) => note.localId));

    const next: RenderedNote[] = notes.map((note) =>
      addedIds.has(note.localId) ? { note, animationState: 'enter' as const } : { note },
    );

    // Put freshly-removed rows back at their previous position, as ghosts.
    for (const removedItem of removedNow) {
      const oldIndex = previous.indexOf(removedItem);
      const insertAt = oldIndex < 0 ? next.length : Math.min(oldIndex, next.length);

      next.splice(insertAt, 0, {
        note: removedItem.note,
        animationState: 'exit',
        exitStyle: removedExitStyles.get(removedItem.note.localId),
      });
    }

    // Carry any still-fading ghosts forward EXACTLY as they are — same
    // object, same position — so they are never re-measured, re-styled,
    // or re-animated by this pass.
    for (const ghost of stillFading) {
      const oldIndex = previous.indexOf(ghost);
      const insertAt = oldIndex < 0 ? next.length : Math.min(oldIndex, next.length);

      next.splice(insertAt, 0, ghost);
    }

    setRenderedNotes(next);
  }, [notes]);

  /*
   * The new list has now been committed. Only rows this pass actually
   * introduced get animated:
   *
   *   1. A row entering for the first time this pass — fade+slide in
   *      from exactly -100% of its own height.
   *   2. A row exiting for the first time this pass — fade+slide out
   *      to exactly -100% of its own height. Both distances match the
   *      resting rows' own FLIP travel (below), so the motions overlap
   *      and read as one row pushing another rather than two unrelated
   *      things happening at once.
   *   3. Every RESTING row whose measured position actually changed
   *      between the last commit and this one — not just "the one
   *      neighbor next to whatever changed", so this still works
   *      correctly no matter how many rows were added or removed in
   *      one pass.
   *
   * A row NOT in this pass's fresh entered/exited sets is left alone,
   * even if it's still mid-animation from an earlier pass — see
   * freshChangeRef's own comment for why that matters.
   */
  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const duration = prefersReducedMotion() ? 1 : ANIMATION_MS;
    const beforeTops = beforeTopsRef.current;
    const { entered, exited, isStructural } = freshChangeRef.current;

    for (const item of renderedNotes) {
      const element = list.querySelector<HTMLElement>(
        '[data-sidebar-note-id="' + item.note.localId + '"]',
      );

      if (!element) continue;

      if (item.animationState === 'enter') {
        if (entered.has(item.note.localId)) {
          safeAnimate(element, 
            [
              { opacity: 0, transform: 'translate3d(0, -100%, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            { duration, easing: ANIMATION_EASING, fill: 'both' },
          );
        }
        continue;
      }

      if (item.animationState === 'exit') {
        if (exited.has(item.note.localId)) {
          safeAnimate(element, 
            [
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              { opacity: 0, transform: 'translate3d(0, -100%, 0)' },
            ],
            { duration, easing: ANIMATION_EASING, fill: 'both' },
          );
        }
        continue;
      }

      // A resting row. Only worth animating on a pass that actually
      // added or removed something — an ordinary re-sort (e.g. editing
      // a note bumps it by recency) isn't part of this push/pull effect.
      if (!isStructural) continue;

      const before = beforeTops.get(item.note.localId);
      if (before === undefined) continue;

      const after = element.getBoundingClientRect().top;
      const deltaY = before - after;

      if (Math.abs(deltaY) < 0.5) continue;

      safeAnimate(element, 
        [
          { transform: 'translate3d(0, ' + deltaY + 'px, 0)' },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        { duration, easing: ANIMATION_EASING, fill: 'both' },
      );
    }

    /*
     * Consume-and-clear. Without this, a LATER renderedNotes change that
     * has nothing to do with this pass — e.g. the cleanup effect below
     * stripping this same ghost once its timer fires — would find this
     * same "yes, a real add/remove happened, and here's the before/after
     * position data" left over from this pass, and replay the exact same
     * enter/exit/FLIP animations a second time. Nothing after this pass
     * should treat that leftover data as fresh until the next real
     * `notes` change sets it again.
     */
    freshChangeRef.current = { entered: new Set(), exited: new Set(), isStructural: false };
  }, [renderedNotes]);

  /*
   * Clear a row's animationState once its own animation has actually
   * had time to finish — one timer per row, set once and left alone,
   * rather than one timer for the whole list that keeps getting pushed
   * back by unrelated churn (see exitTimersRef's own comment).
   */
  useEffect(() => {
    const duration = prefersReducedMotion() ? 1 : ANIMATION_MS;

    for (const item of renderedNotes) {
      if (!item.animationState) continue;

      const id = item.note.localId;

      if (exitTimersRef.current.has(id)) continue;

      const timer = window.setTimeout(() => {
        exitTimersRef.current.delete(id);

        setRenderedNotes((current) =>
          current
            .filter((entry) => !(entry.note.localId === id && entry.animationState === 'exit'))
            .map((entry) =>
              entry.note.localId === id && entry.animationState === 'enter'
                ? { note: entry.note }
                : entry,
            ),
        );
      }, duration);

      exitTimersRef.current.set(id, timer);
    }
  }, [renderedNotes]);

  // Only on unmount: stop any still-pending timers from firing a state
  // update on a component that's no longer there.
  useEffect(() => {
    return () => {
      for (const timer of exitTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      exitTimersRef.current.clear();
    };
  }, []);

  return (
    <ul
      ref={listRef}
      className="app-shell__note-list"
      role="list"
    >
      {renderedNotes.map((item) => (
        <SidebarNoteItem
          key={item.note.localId}
          note={item.note}
          isActive={isRowActive(item.note, activeLocalId, activeNoteId, pendingActiveLocalId)}
          onContextMenu={onNoteContextMenu}
          isMenuOpen={contextMenuNoteLocalId === item.note.localId}
          animationState={item.animationState}
          exitStyle={item.exitStyle}
        />
      ))}
    </ul>
  );
}
