/**
 * Runs once before every test file.
 */
import '@testing-library/jest-dom/vitest';

/*
 * jsdom has no IndexedDB — it implements the DOM, not the whole platform. This
 * installs a spec-compliant implementation on the global, so the auth token
 * store can be tested for real rather than behind a mock of itself.
 *
 * Step 7 needs the same shim for the notes database.
 */
import 'fake-indexeddb/auto';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { resetDatabase } from './harness';
import { server } from './msw/server';

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    ((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList);
});

/*
 * jsdom implements the DOM, not scrolling — window.scrollTo is a no-op stub
 * there, but Element.prototype.scrollTo does not exist at all. RouteFocus
 * calls it on real scroll containers (`.note-detail__scroll`,
 * `.app-shell__main`) after every route change; without this stub, every
 * test that navigates past the first render throws
 * "scrollTo is not a function" from inside that effect. Real browsers
 * implement it natively, so this only ever matters under jsdom.
 */
beforeAll(() => {
  if (typeof Element.prototype.scrollTo !== 'function') {
    // no-op: jsdom has no layout, so there is nothing to actually scroll.
    Element.prototype.scrollTo = () => {};
  }
});

/*
 * jsdom implements the DOM, not layout (see vite.config.ts's own note on
 * getBoundingClientRect) — but for Range and Document it goes further than
 * "returns zeros": Range.prototype.getClientRects, Range.prototype.
 * getBoundingClientRect, and Document.prototype.elementFromPoint do not
 * exist on jsdom 30 AT ALL (verified directly: `'getClientRects' in
 * document.createRange()` is false). ProseMirror's own cursor/paste
 * position math (coordsAtPos → singleRect, posAtCoords) calls exactly
 * these, unconditionally, on every keystroke and paste once a real
 * @tiptap/react editor is mounted (EditorSurface.tsx) — without this shim
 * every such test throws `TypeError: target.getClientRects is not a
 * function` or `doc.elementFromPoint is not a function` from inside
 * prosemirror-view, not from anything in this app's own code.
 *
 * Zeroed/empty results, matching Element.prototype.getBoundingClientRect's
 * own existing jsdom behaviour (see vite.config.ts) — this does not give
 * tests real layout, it only stops jsdom's *missing* methods from
 * crashing ProseMirror the way its *stubbed-to-zero* ones already don't.
 */
beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = (): DOMRectList => [] as unknown as DOMRectList;
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = (): DOMRect =>
      ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {
          return this;
        },
      }) as DOMRect;
  }
  if (typeof document.elementFromPoint !== 'function') {
    // Real browsers resolve the element under a point via layout; jsdom has
    // none to consult, so there is no coordinate this could correctly
    // answer for. `null` is what the real API returns when nothing is
    // there, and ProseMirror's own callers (posAtCoords) already handle
    // that case, falling back rather than assuming a hit.
    document.elementFromPoint = (): Element | null => null;
  }
});

/*
 * onUnhandledRequest: 'error' is what makes the mock server trustworthy.
 *
 * The default lets an unmatched request through to the REAL network, so a
 * typo'd path quietly tries to reach a server that is not running and the test
 * fails with a confusing connection error. Failing loudly turns that into
 * "no handler for GET /api/v1/nots".
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

/*
 * Removes per-test overrides while keeping the defaults.
 *
 * Without this, a test that stubs a 500 leaves that 500 in place for every
 * test after it — order-dependent failures, which are the worst kind to debug
 * because the failing test is not the broken one.
 */
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/*
 * Unmounts anything render() mounted.
 *
 * RTL registers this automatically only when Vitest runs with globals: true.
 * We chose globals: false in 1F so describe/it/expect are imported explicitly,
 * which means registering by hand. Without it, renders accumulate in one
 * document — and a test can pass by matching an element a PREVIOUS test
 * rendered, a false green that survives deleting the code under test.
 */
afterEach(cleanup);

/*
 * Empties Dexie between tests.
 *
 * fake-indexeddb lives as long as the module, not the test. Since 7C the list
 * renders from the database rather than from a response, so a leaked row is
 * not a stale mock — it is a note appearing in a test that never created one,
 * and the resulting green is meaningless.
 */
afterEach(async () => {
  await resetDatabase();
});

/*
 * Empties Dexie again, before the NEXT test even starts.
 *
 * useAutoSaveScheduler's unmount cleanup makes a best-effort final save
 * (`void run()`), deliberately fire-and-forget — a React effect cleanup
 * cannot be awaited. `cleanup()` above unmounts synchronously and returns
 * long before that save's chain (dispatch -> fetch through MSW -> catch ->
 * a Dexie/IndexedDB transaction) settles; each hop is a real event-loop
 * turn, so no fixed number of awaits after cleanup() reliably outlasts it.
 *
 * So the previous test's straggling write can land AFTER afterEach's
 * resetDatabase already ran — queuing that test's data into the next test's
 * tables. Clearing again here wipes any straggler that arrived in the gap.
 */
beforeEach(async () => {
  await resetDatabase();
});

/*
 * Clears localStorage between tests, alongside the Dexie reset above.
 *
 * useEverStandalone() persists a one-directional "this browser was once
 * standalone" flag to real localStorage (EVER_STANDALONE_STORAGE_KEY),
 * by design — it must survive reloads. But fake-indexeddb and jsdom's
 * localStorage both live as long as the module, not the test, and only
 * Dexie was being reset above. A test earlier in the file that goes
 * standalone (e.g. 7a/7b in App.test.tsx) leaves that flag set, so a
 * LATER test in the same file (7c, iOS Safari, never installed) reads
 * everStandalone as true from its very first render and skips straight
 * past the mandatory InstallPage — a real cross-test leak, not a flaky
 * timing issue.
 */
afterEach(() => {
  localStorage.clear();
});

/*
 * jsdom has no Web Animations API. The motion module (src/design-system/motion)
 * calls Element.animate and getAnimations, so tests get a stub whose animation
 * is already finished. motion.test.ts spies on animate to check what was asked.
 */
beforeAll(() => {
  if (typeof Element.prototype.animate !== 'function') {
    Element.prototype.animate = function animate(): Animation {
      return { finished: Promise.resolve(), cancel() {} } as unknown as Animation;
    };
  }
  if (typeof Element.prototype.getAnimations !== 'function') {
    Element.prototype.getAnimations = (): Animation[] => [];
  }
});

/*
 * jsdom has no ResizeObserver. RemoteCarets and useKeepScroll construct one on
 * mount; there is no layout here for it to observe, so a stub that never
 * fires is the honest equivalent.
 */
beforeAll(() => {
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});
