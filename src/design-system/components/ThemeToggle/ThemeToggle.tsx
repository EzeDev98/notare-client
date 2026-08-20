import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/app/providers/theme-context';
import type { ThemePreference } from '@/lib/theme/theme';
import './ThemeToggle.css';

/*
 * Lucide, not hand-written SVG — same icon standardization pass as
 * navItems.tsx. `Monitor` stands in for "System": Lucide has no literal
 * "OS preference" glyph, and a monitor/display is the closest existing
 * mark to what the hand-drawn version was already drawing (a screen with
 * a stand).
 */
const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon aria-hidden="true" /> },
  { value: 'system', label: 'System', icon: <Monitor aria-hidden="true" /> },
];

/**
 * The one UI control for `useTheme()` in the whole app. The engine
 * (`lib/theme/theme.ts`, `ThemeProvider`) has been fully built and wired
 * since early on — persisted three-state preference, live OS
 * subscription, pre-paint flash prevention in index.html's inline
 * script — but nothing ever called `setPreference`. This is that control.
 *
 * `role="radiogroup"` + `role="radio"`/`aria-checked`, not a plain button
 * row — three mutually exclusive states is exactly what a radio group
 * means, and it's what lets a screen reader announce "Dark, selected"
 * rather than three identical unlabelled buttons.
 *
 * Icon-only, not icon+label — same reasoning `.app-shell__nav-link`'s
 * mobile/tablet treatment already uses (labels clipped via
 * VisuallyHidden's technique, not removed): a 240px sidebar has room for
 * three icons in a row, not three icons plus three words.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          className="theme-toggle__button"
          onClick={() => {
            setPreference(option.value);
          }}
        >
          {option.icon}
          <span className="ds-visually-hidden">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
