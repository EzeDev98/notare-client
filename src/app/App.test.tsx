/** Tests for App. */
import { act, render, screen } from '@testing-library/react';
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
    setStandalone(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

function makeBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: 'android' });
  return event;
}

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
