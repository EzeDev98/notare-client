import { Avatar, type Tint } from './Avatar';

import './Avatar.css';

interface AvatarStackProps {
  people: ReadonlyArray<{ name: string; tint: Tint }>;
  /** Avatars shown before "+N". Default 4. */
  max?: number | undefined;
}

/** Overlapping avatars, at most 4, then "+N". */
export function AvatarStack({ people, max = 4 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="n-avatars" role="group" aria-label={`${String(people.length)} people`}>
      {shown.map((person) => (
        <Avatar key={person.name} name={person.name} tint={person.tint} />
      ))}
      {extra > 0 ? (
        <span className="n-avatar n-avatar--plain" role="img" aria-label={`${String(extra)} more`}>
          {`+${String(extra)}`}
        </span>
      ) : null}
    </span>
  );
}
