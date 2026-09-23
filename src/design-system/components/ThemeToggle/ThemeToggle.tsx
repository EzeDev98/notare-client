import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { DesktopIcon, MoonIcon, SunIcon } from '@patternfly/react-icons';

import { useTheme } from '@/app/providers/theme-context';
import type { ThemePreference } from '@/lib/theme/theme';
import './ThemeToggle.css';

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <DesktopIcon /> },
];

/** Light / Dark / System as a PatternFly icon ToggleGroup. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <ToggleGroup aria-label="Theme" className="theme-toggle">
      {OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          icon={option.icon}
          aria-label={option.label}
          isSelected={preference === option.value}
          onChange={() => {
            setPreference(option.value);
          }}
        />
      ))}
    </ToggleGroup>
  );
}
