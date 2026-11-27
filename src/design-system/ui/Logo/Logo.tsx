/** The Notare logo. */
import './Logo.css';

interface LogoProps {
  scheme: 'light' | 'dark';
  size?: 'md' | 'lg';
  label?: string;
  className?: string;
}

const SRC = { light: '/logo-light.png', dark: '/logo-dark.png' } as const;

export function Logo({ scheme, size = 'md', label, className }: LogoProps) {
  const classes = ['ui-logo', size === 'lg' && 'ui-logo--lg', className].filter(Boolean).join(' ');
  return <img className={classes} src={SRC[scheme]} alt={label ?? ''} />;
}
