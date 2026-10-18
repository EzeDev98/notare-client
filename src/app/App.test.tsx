import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '@/app/App';
import { WELCOME } from '@/features/auth/authContent';
import { setStoredRefreshToken } from '@/features/auth/tokenStore';
import { INSTALL, INTRO, MANUAL } from '@/features/onboarding/onboardingContent';
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

const SPLASH = { name: 'Loading Notare' };

const emptySyncHandlers = [
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
];

describe('7a — Android Chrome, not installed', () => {
  it('shows the splash, then the install gate, then hands off to the app once installed', async () => {
    const displayMode = stubDisplayModeMatchMedia(false);
    Object.defineProperty(window, 'onbeforeinstallprompt', { value: null, configurable: true });
    initInstallPrompt();

    render(<App />);

    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: WELCOME.title })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: INTRO.cta }));
    expect(await screen.findByRole('heading', { name: INSTALL.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: WELCOME.title })).not.toBeInTheDocument();

    const bip = makeBeforeInstallPromptEvent('accepted');
    act(() => {
      window.dispatchEvent(bip);
    });

    await user.click(screen.getByRole('button', { name: INSTALL.cta }));
    expect(bip.prompt).toHaveBeenCalledOnce();

    // The gate leaves on its own the moment the app counts as installed.
    act(() => {
      displayMode.setStandalone(true);
    });

    expect(await screen.findByRole('heading', { name: WELCOME.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: INSTALL.title })).not.toBeInTheDocument();
  });
});

describe('7b — Android Chrome, already installed/standalone', () => {
  it('shows the splash, then goes straight to the welcome page when there is no stored session', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();

    render(<App />);

    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: WELCOME.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: INSTALL.title })).not.toBeInTheDocument();
  });

  it('shows the splash, then goes straight to notes when a session is already stored', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();
    server.use(...emptySyncHandlers);
    await setStoredRefreshToken('refresh-1');

    render(<App />);

    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Notes' }, { timeout: 3_000 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: INSTALL.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: WELCOME.title })).not.toBeInTheDocument();
  });
});

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

  it('shows the splash, then the manual install steps, never the native prompt', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: IOS_USER_AGENT, configurable: true });
    Reflect.deleteProperty(window, 'onbeforeinstallprompt');
    stubDisplayModeMatchMedia(false);
    initInstallPrompt();

    render(<App />);

    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: INTRO.cta }));
    await user.click(await screen.findByRole('button', { name: INSTALL.cta }));

    // iOS has no install prompt, so the install button leads to written steps instead.
    expect(await screen.findByText(MANUAL.ios[0].text)).toBeInTheDocument();
    expect(screen.getByText(MANUAL.ios[1].text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: INSTALL.cta })).not.toBeInTheDocument();
  });
});

describe('7d — app killed and reopened', () => {
  it('replays the full splash sequence on every fresh mount, not just the first', async () => {
    stubDisplayModeMatchMedia(true);
    initInstallPrompt();
    server.use(...emptySyncHandlers);
    await setStoredRefreshToken('refresh-1');

    const first = render(<App />);
    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Notes' }, { timeout: 3_000 })).toBeInTheDocument();

    first.unmount();

    render(<App />);
    expect(screen.getByRole('status', SPLASH)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Notes' }, { timeout: 3_000 })).toBeInTheDocument();
  });
});
