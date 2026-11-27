/** The theme context and its hook. */
import { createContext, use } from 'react';

import type { ResolvedTheme, ThemePreference } from '@/lib/theme/theme';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>.');
  }
  return context;
}
