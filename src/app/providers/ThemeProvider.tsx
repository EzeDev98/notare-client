/** Holds the theme choice and applies it. */
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
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(preference));

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
    setResolved(resolveTheme(next));
  }, []);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (preference !== 'system') return;

    setResolved(systemThemeNow());

    return subscribeToSystemTheme(setResolved);
  }, [preference]);

  return <ThemeContext value={{ preference, resolved, setPreference }}>{children}</ThemeContext>;
}

function systemThemeNow(): ResolvedTheme {
  return resolveTheme('system');
}
