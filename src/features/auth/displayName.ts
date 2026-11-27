/** The person's full name, or their username. */
import type { CurrentUser } from '@/features/auth/types';

export function displayName(user: CurrentUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}
