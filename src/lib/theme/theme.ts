/** Reads, stores and applies the theme. */
export type ThemePreference = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'notare.theme';
export const THEME_ATTRIBUTE = 'data-theme';
export const PATTERNFLY_DARK_CLASS = 'pf-v6-theme-dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

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
  } catch {}
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.classList.toggle(PATTERNFLY_DARK_CLASS, theme === 'dark');
}

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
