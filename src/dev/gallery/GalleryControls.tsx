import { Checkbox, Radio } from '@/design-system/ui';

export type Panels = 'both' | 'light' | 'dark';

interface GalleryControlsProps {
  panels: Panels;
  onPanels: (panels: Panels) => void;
  reduced: boolean;
  onReduced: (reduced: boolean) => void;
}

/** Collapsed "Prototype controls" box: scenario switches that are not theme or device. */
export function GalleryControls({ panels, onPanels, reduced, onReduced }: GalleryControlsProps) {
  return (
    <details className="gallery-controls">
      <summary className="gallery-controls__summary">Prototype controls</summary>
      <div className="gallery-controls__body">
        <div className="gallery-stack" role="radiogroup" aria-label="Panels shown">
          {(['both', 'light', 'dark'] as const).map((value) => (
            <Radio
              key={value}
              name="gallery-panels"
              label={value === 'both' ? 'Show light and dark side by side' : `Show ${value} only`}
              checked={panels === value}
              onChange={() => {
                onPanels(value);
              }}
            />
          ))}
        </div>
        <Checkbox
          label="Force reduced motion"
          hint="Affects animations run by code. The spinner follows your computer's own setting."
          checked={reduced}
          onChange={(event) => {
            onReduced(event.target.checked);
          }}
        />
      </div>
    </details>
  );
}
