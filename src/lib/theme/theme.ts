/**
 * Theme resolution and persistence. No React — this is testable without
 * rendering anything, and the provider on top of it is a thin wrapper.
 */

/**
 * What the USER chose. Three states, not a boolean: dropping 'system' loses
 * the ability to follow the OS, which is what most people want and what makes
 * the app change at sunset without them touching it.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * What is actually ON SCREEN. Two names because these are two different facts
 * — conflating them gives you a settings toggle reading "Light" when the user
 * picked "System" at midday.
 */
export type ResolvedTheme = 'light' | 'dark';

/*
 * DUPLICATED in the inline <script> in index.html. That script must run before
 * the first paint to avoid a flash, and modules load after paint, so it cannot
 * import from here.
 *
 * If either constant changes, change it in BOTH places. Made loud rather than
 * solved with a build-time inlining step, which is machinery for eight lines.
 */
export const THEME_STORAGE_KEY = 'notare.theme';
export const THEME_ATTRIBUTE = 'data-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Reads the stored preference, defaulting to 'system'.
 *
 * Every access is wrapped: localStorage THROWS in Safari private browsing and
 * when quota is exhausted. A theme preference is not worth crashing the app
 * over — the correct failure is "fall back to system and carry on".
 */
export function readStoredPreference(): ThemePreference {
  try {
    const stored: unknown = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Non-fatal by design. The theme still applies for this session; it just
    // will not survive a reload.
  }
}

/** What the OS currently prefers. */
export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Collapses a preference into the theme actually shown. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Applies the theme to <html>, where CSS can see it.
 *
 * On <html> rather than <body> so it also covers anything rendered outside the
 * React root — and so the inline script can set it before <body> exists.
 */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Subscribes to OS theme changes. Returns an unsubscribe function.
 *
 * Genuinely external-system synchronisation, which is what effects are FOR
 * (§9) — unlike most useEffect calls. The returned cleanup is not optional:
 * without it every re-subscribe leaks a listener, and the leak is silent until
 * a theme change fires N stale callbacks at once.
 */
export function subscribeToSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent): void => {
    onChange(event.matches ? 'dark' : 'light');
  };

  query.addEventListener('change', handler);
  return () => {
    query.removeEventListener('change', handler);
  };
}
