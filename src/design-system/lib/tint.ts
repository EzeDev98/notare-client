import type { Tint } from '../ui/Avatar/Avatar';

/** The same person always gets the same colour, on every device. */
export function tintFor(userId: number): Tint {
  return ((Math.abs(userId) % 6) + 1) as Tint;
}
