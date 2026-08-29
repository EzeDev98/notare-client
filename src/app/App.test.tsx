import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '@/app/App';
import { setStoredRefreshToken } from '@/features/auth/tokenStore';
import { initInstallPrompt } from '@/pwa/installPrompt';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * Step 7a. Android Chrome, not installed → splash → mandatory install
 * page → login/notes.
 *
 * Nothing under App.tsx's own tree had a test before this — router.test.tsx
 * deliberately renders `routes` directly, bypassing AppBoot entirely (its
 * own file header explains why: it wants the route tree, not the boot
 * gate). This is the first test to go through the real composition root,
 * exactly as main.tsx does, so it also has to do main.tsx's other job:
 * call initInstallPrompt() itself, since App.tsx never does — without it
 * the global beforeinstallprompt/appinstalled listeners this test depends
 * on are simply not registered.
 *
 * 'Android Chrome' specifically (not just 'a non-standalone browser')
 * means stubbing `'onbeforeinstallprompt' in window` too, not only
 * display-mode. Without that, getInstallFlowSupport() reads jsdom's
 * default (no such property) and renders InstallPage's INSTRUCTIONAL
 * (iOS-style) branch instead of the native one — silently testing the
 * wrong platform's UI while asserting on the right platform's name.
 */

/**
 * A `matchMedia('(display-mode: standalone)')` stand-in that can actually
 * change and fire — setup.ts's global stub is a static `matches: false`
 * with no-op listener methods, correct as a baseline default for every
 * other test file but useless here: this test's whole point is the
 * transition FROM false TO true.
 *
 * SCOPED BY QUERY STRING — this is the fix for a real bug this helper had
 * before: `window.matchMedia` is one global function serving EVERY caller
 * in the app, not just displayMode.ts. ThemeProvider also calls it, for
 * '(prefers-color-scheme: dark)' (see theme.ts's subscribeToSystemTheme).
 * The original version returned the SAME mock MediaQueryList object no
 * matter what query it was asked for, so ThemeProvider's dark-mode
 * listener and this helper's standalone listener ended up in the same
 * `listeners` Set — and `setStandalone()`'s `listener()` (no arguments)
 * would then also fire theme.ts's handler, which destructures
 * `event.matches` and crashes on `undefined`. Only the standalone query
 * gets the live, settable mock below; anything else (the dark-mode query
 * included) gets its own independent, static, always-`matches: false`
 * MediaQueryList — same shape as setup.ts's global default — so a caller
 * asking about a different media feature entirely neither observes nor
 * participates in this test's standalone transition.
 */
function stubDisplayModeMatchMedia(initialStandalone: boolean) {
  const STANDALONE_QUERY = '(display-mode: standalone)';
  let matches = initialStandalone;
  const listeners = new Set<() => void>();

  const standaloneMql = {
    get matches() {
      return matches;
    },
    media: STANDALONE_QUERY,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  function makeInertMql(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }

  window.matchMedia = vi.fn((query: string) =>
    query === STANDALONE_QUERY ? standaloneMql : makeInertMql(query),
  );

  return {
    /** Flips display-mode live, the way a successful install does. */
    setStandalone(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Minimal BeforeInstallPromptEvent stand-in — see installPrompt.ts. */
function makeBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: 'android' });
  return event;
}

/*
 * Captured in beforeAll, NOT at module top-level. Module top-level code
 * runs at import time, before tests/setup.ts's own beforeAll has run —
 * so at that point window.matchMedia is still whatever raw jsdom
 * provides (nothing), and "restoring" to that later would leave EVERY
 * test after the first one in this file with a broken matchMedia, not
 * setup.ts's intended ambient default. beforeAll hooks from setupFiles
 * run before a test file's own beforeAll hooks, so by the time this one
 * fires, setup.ts's default stub is already in place — that is the
 * value worth restoring to.
 */
let originalMatchMedia: typeof window.matchMedia;

beforeAll(() => {
  originalMatchMedia = window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  Reflect.deleteProperty(window, 'onbeforeinstallprompt');
});

describe('7a — Android Chrome, not installed', () => {
  it('shows the splash, then the mandatory install page, then hands off to login once installed', async () => {
    const displayMode = stubDisplayModeMatchMedia(false);
    // Presence alone is what installSupport.ts's supportsBeforeInstallPromptEvent()
    // checks for — the value is never read.
    Object.defineProperty(window, 'onbeforeinstallprompt', { value: null, configurable: true });
    initInstallPrompt();

    render(<App />);

    /*
     * SPLASH FIRST. AuthProvider's startup restore (a real IndexedDB read
     * via fake-indexeddb, per tests/setup.ts) is genuinely async, so
     * immediately after render() the auth status is still 'initializing'
     * — this assertion has to win the race against that resolving, which
     * is exactly why it comes before any `await`/`waitFor` in this test.
     */
    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ready to install' })).not.toBeInTheDocument();

    /*
     * MANDATORY INSTALL PAGE. isStandalone is false throughout, so the
     * instant auth stops initializing, bootPhase must land on 'install',
     * never 'ready' — there is no session state that skips this gate.
     */
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ready to install' })).toBeInTheDocument();
    });

    // Nothing from the router tree exists yet — the gate is not merely
    // shown alongside the app, it replaces it entirely (App.tsx's
    // QueryProvider/ToastProvider/RouterProvider only mount in 'ready').
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();

    // The native flow: Chrome has signalled the app is installable.
    const bip = makeBeforeInstallPromptEvent('accepted');
    act(() => {
      window.dispatchEvent(bip);
    });

    /*
     * A prior version of this asserted findByRole(...) then toBeEnabled()
     * as two separate steps — a real, if intermittent, race: findByRole
     * resolves the moment a button with this accessible NAME exists,
     * regardless of its disabled state (InstallPage always renders this
     * button; only the `disabled` attribute depends on `available`). It
     * could resolve in the gap between the button appearing (still
     * disabled) and the beforeinstallprompt-triggered state update
     * actually flushing to `available: true`. waitFor here polls the
     * ENABLED condition itself, not just existence, so it can't return
     * before the state update it's meant to be waiting for has landed.
     */
    let installButton: HTMLElement;
    await waitFor(() => {
      installButton = screen.getByRole('button', { name: 'Install now' });
      expect(installButton).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(installButton!);
    expect(bip.prompt).toHaveBeenCalledOnce();

    /*
     * → LOGIN. Accepting a real Chrome install prompt is what flips
     * display-mode mid-session (displayMode.ts's own doc comment) — no
     * reload. Simulating that is what turns 'install' into 'ready' here.
     * No stored session exists (fresh fake-indexeddb per test, via
     * tests/setup.ts's resetDatabase), so 'ready' resolves through
     * RequireAuth straight to /login, not /notes.
     */
    act(() => {
      displayMode.setStandalone(true);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Ready to install' })).not.toBeInTheDocument();
  });
});

/**
 * Step 7b. Android Chrome, already installed/standalone → splash →
 * login/notes, no install page.
 *
 * Reuses 7a's own stubDisplayModeMatchMedia rather than a second helper:
 * these tests never call .setStandalone() to transition it (standalone is
 * true from the very first render and stays there), so they never touch
 * the listener-collision path that makes 7a's OWN later transition crash
 * inside theme.ts (ThemeProvider's dark-mode matchMedia listener and
 * displayMode's standalone listener end up sharing one mock MediaQueryList
 * object, since the stub returns the same instance for every query string
 * regardless of which media feature was asked for — pre-existing in 7a's
 * helper, not introduced here, and out of scope for Step 7b to fix).
 */
describe('7b — Android Chrome, already installed/standalone', () => {
  it('shows the splash, then goes straight to login when there is no stored session', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();

    render(<App />);

    // SPLASH FIRST — same race-with-async-restore reasoning as 7a: this has
    // to be asserted before any await, or AuthProvider's restore may have
    // already resolved by the time this line runs.
    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();

    // → LOGIN directly. isStandalone is true from the start, so bootPhase
    // never has a reason to land on 'install' — nothing here should ever
    // show InstallPage, even for a frame.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Ready to install' })).not.toBeInTheDocument();
  });

  it('shows the splash, then goes straight to notes when a session is already stored', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();

    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 1 }),
      ),
      // Reaching 'ready' as an authenticated session starts the sync engine
      // (src/sync/pull.test.ts uses the same response shape) — without
      // this override, its first poll is an MSW unhandled-request error
      // once ownerId resolves, since the default handlers only cover the
      // happy path for things every OTHER test file already needs.
      http.get(`${BASE}/sync`, () =>
        HttpResponse.json({
          changed: [],
          deletedIds: [],
          nextCursor: '2026-08-13T09:00:00.000',
          hasMore: false,
        }),
      ),
    );

    // Seeds a real session the same way AuthProvider's own startup restore
    // reads one — via tokenStore, not by rendering a login form through
    // MSW. The default authHandlers answer POST /auth/refresh and
    // GET /user/me unconditionally (see authHandlers.ts), so any stored
    // refresh token is enough to resolve 'authenticated'.
    await setStoredRefreshToken('refresh-1');

    render(<App />);

    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();

    // → NOTES directly, past login entirely. Empty Dexie + an empty /notes
    // page means NotesLandingPage's empty state, not a redirect to a note
    // — see NotesLandingPage's own doc comment on the two branches.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Ready to install' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

/**
 * Step 7c. iOS Safari → splash → instructional variant, never a hard
 * block.
 *
 * 'iOS Safari' specifically means stubbing navigator.userAgent to an iOS
 * string (installSupport.ts's isIOS() checks this before anything else)
 * AND making sure onbeforeinstallprompt is absent — jsdom lacks it by
 * default, but the delete is explicit so this test does not depend on
 * that default silently staying true.
 */
describe('7c — iOS Safari', () => {
  const IOS_USER_AGENT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('shows the splash, then the instructional install variant, never the native/hard-gate one', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: IOS_USER_AGENT, configurable: true });
    Reflect.deleteProperty(window, 'onbeforeinstallprompt');
    // Not standalone (not added to Home Screen yet) — and stubbed
    // explicitly via the same helper 7a/7b use, rather than relying on
    // whatever ambient matchMedia default happens to be in place. ISO
    // Safari never fires a 'change' event this test needs, so the
    // returned .setStandalone() control is simply unused here.
    stubDisplayModeMatchMedia(false);
    initInstallPrompt();

    render(<App />);

    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ready to install' })).toBeInTheDocument();
    });

    // The instructional branch, not 7a's native one — no "Install now"
    // button waiting on an event this platform will never fire.
    expect(screen.queryByRole('button', { name: 'Install now' })).not.toBeInTheDocument();
    expect(screen.getByText(/Tap the Share icon/)).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();

    // NEVER A HARD BLOCK on this path: unlike 7a's native gate — which has
    // no way through while beforeinstallprompt hasn't fired — this variant
    // always has an actionable "Continue", since nothing on iOS will ever
    // fire that event for it to wait on.
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();

    // jsdom's window.close() genuinely tears the window down (unlike most
    // real browsers, which silently no-op it for a tab they didn't open —
    // see InstallPage's own doc comment on that caveat), which would break
    // RTL's cleanup after this test. Stubbed so the assertion is "this was
    // called", not "the test environment survived calling it".
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    const user = userEvent.setup();
    await user.click(continueButton);

    expect(closeSpy).toHaveBeenCalledOnce();
  });
});

/**
 * Step 7d. App killed and reopened → full splash sequence replays every
 * time.
 *
 * Rather than reload the module (the only way to truly imitate a killed
 * process, and not something Vitest can do mid-test), this unmounts and
 * re-renders <App /> within the SAME test — which is actually a STRICTER
 * check than a real restart: a real kill also clears any module-level
 * JS state, but unmount/remount here does not. So if a future change
 * introduced a module-level "already shown this session" flag instead
 * of something genuinely tied to a fresh boot, this test would still
 * catch it, where a full process restart might not exercise the same
 * code path convincingly in a unit test. bootPhase's actual guarantee
 * (useBootPhase.ts, useAuth's 'initializing' status) is that every fresh
 * AuthProvider mount starts there again with no memory of a previous
 * one, which is exactly what makes this true on a real device too.
 *
 * Reuses the SAME already-installed/standalone-with-session scenario as
 * 7b's second test — the point here isn't a new boot path, it's that
 * the existing one is not a one-time thing.
 */
describe('7d — app killed and reopened', () => {
  it('replays the full splash sequence on every fresh mount, not just the first', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();

    server.use(
      http.get(`${BASE}/notes`, () =>
        HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 1 }),
      ),
      http.get(`${BASE}/sync`, () =>
        HttpResponse.json({
          changed: [],
          deletedIds: [],
          nextCursor: '2026-08-13T09:00:00.000',
          hasMore: false,
        }),
      ),
    );

    await setStoredRefreshToken('refresh-1');

    // FIRST OPEN.
    const first = render(<App />);
    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument();
    });

    // KILL.
    first.unmount();

    // REOPEN. Same stubs, same stored session, nothing re-seeded —
    // the point is that unchanged conditions still produce the splash
    // again, because it comes from AuthProvider's fresh 'initializing'
    // status on mount, not anything remembered from the previous visit.
    render(<App />);
    expect(screen.getByText('Write Anywhere. Sync Everywhere.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No notes yet' })).toBeInTheDocument();
    });
  });
});
