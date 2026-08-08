import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  subscribeToSystemTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme/theme';

interface ThemeContextValue {
  /** What the user chose — what a settings control should show as selected. */
  preference: ThemePreference;
  /** What is on screen — what an icon toggle should reflect. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  /*
   * Initialised from storage via a FUNCTION, not a value. useState(expr) runs
   * expr on every render and throws the result away; useState(() => expr) runs
   * it once. Harmless here, a real cost when the initialiser touches storage
   * or does work — worth having the habit.
   *
   * The inline script in index.html has already applied the correct theme by
   * this point. React is catching up to the DOM, not driving it — which is why
   * there is no flash.
   */
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);

    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyTheme(nextResolved);
  }, []);

  /*
   * A legitimate effect: subscribing to an OS-level media query is
   * synchronisation with an external system (§9).
   *
   * Only while following the system. Subscribing unconditionally would mean a
   * user who explicitly chose Light gets flipped to dark at sunset — their
   * choice silently overridden by the thing they opted out of.
   */
  useEffect(() => {
    if (preference !== 'system') return;

    // Re-read on subscribe: the OS may have changed between the last render
    // and this effect running.
    setResolved(systemThemeNow());
    applyTheme(systemThemeNow());

    return subscribeToSystemTheme((next) => {
      setResolved(next);
      applyTheme(next);
    });
  }, [preference]);

  return <ThemeContext value={{ preference, resolved, setPreference }}>{children}</ThemeContext>;
}

function systemThemeNow(): ResolvedTheme {
  return resolveTheme('system');
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  /*
   * Throwing rather than returning a default. A component reading the theme
   * outside the provider is a wiring bug, and a silent default turns it into a
   * mystery where the theme "just does not work" on one screen. The null in
   * the context type exists precisely so this check is required.
   */
  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>.');
  }
  return context;
}
