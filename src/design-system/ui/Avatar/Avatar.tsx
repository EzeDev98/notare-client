import './Avatar.css';

/** Which collaborator colour, 1 to 6 (--color-cursor-1 to 6). */
export type Tint = 1 | 2 | 3 | 4 | 5 | 6;

interface AvatarProps {
  name: string;
  tint: Tint;
}

/** 24px circle with the person's first letter, in their collaborator colour. */
export function Avatar({ name, tint }: AvatarProps) {
  return (
    <span className={`n-avatar n-avatar--${String(tint)}`} role="img" aria-label={name}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
