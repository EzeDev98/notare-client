/** Picks the same colour for the same person every time. */
import type { Tint } from '../ui/Avatar/Avatar';

export function tintFor(userId: number): Tint {
  return ((Math.abs(userId) % 6) + 1) as Tint;
}
