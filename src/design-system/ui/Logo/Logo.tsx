import './Logo.css';

interface LogoProps {
  /** Which image to show. The screen passes the resolved theme, because design-system/ cannot read it. */
  scheme: 'light' | 'dark';
  size?: 'md' | 'lg';
  /** Spoken name. Leave it out when "Notare" is written next to the logo. */
  label?: string;
  className?: string;
}

const SRC = { light: '/logo-light.png', dark: '/logo-dark.png' } as const;

/** The product logo: always the supplied image, never text. md is 32px, lg is 72px. */
export function Logo({ scheme, size = 'md', label, className }: LogoProps) {
  const classes = ['ui-logo', size === 'lg' && 'ui-logo--lg', className].filter(Boolean).join(' ');
  return <img className={classes} src={SRC[scheme]} alt={label ?? ''} />;
}
