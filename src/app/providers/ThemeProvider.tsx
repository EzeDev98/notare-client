import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { ThemeContext } from '@/app/providers/theme-context';

import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  subscribeToSystemTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme/theme';

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
    setResolved(resolveTheme(next));
  }, []);

  /*
   * Writes the resolved theme to the DOM. Its own effect, keyed on the value
   * rather than on the preference, so it runs on MOUNT for every preference —
   * not just 'system'.
   *
   * Previously applyTheme was called only from setPreference and from the
   * system-subscription effect, which meant a stored 'dark' was applied solely
   * by the inline script in index.html. That worked, and quietly made the
   * React layer depend on the HTML being right: render this app anywhere
   * without that script and stored preferences would stop applying, with no
   * error to explain why.
   *
   * The inline script is now a pure optimisation — it prevents the flash. It
   * is no longer load-bearing for correctness, which is what a performance
   * optimisation should be.
   *
   * Setting a DOM attribute from React state is synchronisation with something
   * outside React's tree, which is what effects are for (§9).
   */
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

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

    // Only updates STATE. The effect above owns the DOM, so there is exactly
    // one place that writes the attribute.
    return subscribeToSystemTheme(setResolved);
  }, [preference]);

  return <ThemeContext value={{ preference, resolved, setPreference }}>{children}</ThemeContext>;
}

function systemThemeNow(): ResolvedTheme {
  return resolveTheme('system');
}
