import { useTheme } from '@/app/providers/theme-context';

interface LogoProps {
  /** Renders "Notare" beside the mark. Off by default — most placements
   * (the sidebar rail, a compact header) want the mark alone. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The product logo — a supplied raster image, not a drawn mark.
 *
 * An <img>, not inline SVG: this asset is a fixed-color PNG (its own card
 * background + leaf mark, baked in) and cannot use `currentColor`/
 * `var(--color-accent)` to theme itself through the CSS cascade the way an
 * icon font-style SVG can. Instead there are two exports — one with a light
 * card, one with a dark card — and the component picks between them from
 * `useTheme()` so the mark always matches the surface it sits on.
 *
 * Distinct from /icon-192.png, which stays a single static asset for the
 * OS-installed PWA icon (manifest icons can't switch with in-app theme).
 */
const LOGO_SRC = {
  light: '/logo-light.png',
  dark: '/logo-dark.png',
} as const;

export function Logo({ withWordmark = false, className }: LogoProps) {
  const { resolved } = useTheme();

  return (
    <span className={['ds-logo', className].filter(Boolean).join(' ')}>
      <img className="ds-logo__mark" src={LOGO_SRC[resolved]} alt="" width={32} height={32} />
      {withWordmark ? <span className="ds-logo__wordmark">Notare</span> : null}
    </span>
  );
}
