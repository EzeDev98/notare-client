import type { CurrentUser } from '@/features/auth/types';

/** The person's full name, or their username when no name is set. */
export function displayName(user: CurrentUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}
