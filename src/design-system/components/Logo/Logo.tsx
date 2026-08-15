interface LogoProps {
  /** Renders "Notare" beside the mark. Off by default — most placements
   * (the sidebar rail, a compact header) want the mark alone. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The product logo — a supplied raster image, not a drawn mark.
 *
 * An <img>, not inline SVG: unlike an earlier hand-drawn attempt at this
 * component, this asset is a fixed-color PNG (its own cream card +
 * teal leaf, baked in) and cannot use `currentColor`/`var(--color-accent)`
 * to theme itself light/dark through the CSS cascade the way an icon
 * font-style SVG can. It renders identically in both themes — there is
 * no separate dark-mode export of this asset. In practice this reads
 * fine: the icon is a self-contained card with its own border, not a
 * shape meant to blend into the surrounding surface color.
 *
 * Sourced from /icon-192.png — the same file public/manifest.webmanifest
 * uses, so the in-app mark and the installed-app icon are guaranteed to
 * be the same image rather than two assets that can drift apart.
 */
export function Logo({ withWordmark = false, className }: LogoProps) {
  return (
    <span className={['ds-logo', className].filter(Boolean).join(' ')}>
      <img className="ds-logo__mark" src="/icon-192.png" alt="" width={32} height={32} />
      {withWordmark ? <span className="ds-logo__wordmark">Notare</span> : null}
    </span>
  );
}
