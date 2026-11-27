/** A person's initials in their colour. */
import './Avatar.css';

export type Tint = 1 | 2 | 3 | 4 | 5 | 6;

interface AvatarProps {
  name: string;
  tint: Tint;
}

export function Avatar({ name, tint }: AvatarProps) {
  return (
    <span className={`n-avatar n-avatar--${String(tint)}`} role="img" aria-label={name}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
