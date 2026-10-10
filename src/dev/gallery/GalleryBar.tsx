import { Button } from '@/design-system/ui';
import { useTheme } from '@/app/providers/theme-context';
import type { ThemePreference } from '@/lib/theme/theme';

export type Device = 'phone' | 'desktop';

const THEMES: ReadonlyArray<readonly [ThemePreference, string]> = [
  ['system', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

const DEVICES: ReadonlyArray<readonly [Device, string]> = [
  ['phone', 'Phone'],
  ['desktop', 'Desktop'],
];

/** The thin, always-visible row: Theme toggle and Device toggle. */
export function GalleryBar({ device, onDevice }: { device: Device; onDevice: (device: Device) => void }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className="gallery-bar">
      <div className="gallery-bar__group" role="group" aria-label="Theme">
        <span className="gallery-bar__label">Theme</span>
        {THEMES.map(([value, label]) => (
          <Button
            key={value}
            variant={preference === value ? 'secondary' : 'ghost'}
            aria-pressed={preference === value}
            onClick={() => {
              setPreference(value);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="gallery-bar__group" role="group" aria-label="Device">
        <span className="gallery-bar__label">Device</span>
        {DEVICES.map(([value, label]) => (
          <Button
            key={value}
            variant={device === value ? 'secondary' : 'ghost'}
            aria-pressed={device === value}
            onClick={() => {
              onDevice(value);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
