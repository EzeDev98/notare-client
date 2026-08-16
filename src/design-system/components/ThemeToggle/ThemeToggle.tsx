import type { ReactNode } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import type { ThemePreference } from '@/lib/theme/theme';
import './ThemeToggle.css';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  );
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <SystemIcon /> },
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
