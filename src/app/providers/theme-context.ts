import { createContext, use } from 'react';

import type { ResolvedTheme, ThemePreference } from '@/lib/theme/theme';

export interface ThemeContextValue {
  /** What the user chose — what a settings control shows as selected. */
  preference: ThemePreference;
  /** What is on screen — what an icon toggle reflects. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Separated from ThemeProvider.tsx so that file exports only a component and
 * stays Fast Refresh-friendly.
 */
export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  /*
   * Throwing rather than returning a default. A component reading the theme
   * outside the provider is a wiring bug, and a silent default turns it into a
   * mystery where the theme "just does not work" on one screen. The null in
   * the context type is what forces this check.
   */
  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>.');
  }
  return context;
}
