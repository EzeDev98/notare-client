import type { FieldMessages } from '@/design-system/components/Field/Field';

/**
 * Builds the aria-describedby value: the ids of whichever messages exist.
 *
 * Space-separated, and undefined rather than an empty string when there are
 * none — aria-describedby="" is a dangling reference some screen readers
 * announce as an empty description.
 *
 * Lives outside Field.tsx because a module that exports both a component and a
 * plain function cannot preserve state across Fast Refresh; editing it would
 * silently full-reload the page instead of hot-swapping the component.
 */
export function describedBy(
  ids: { hintId: string; errorId: string },
  messages: FieldMessages,
): string | undefined {
  const parts: string[] = [];
  if (messages.hint !== undefined && messages.error === undefined) parts.push(ids.hintId);
  if (messages.error !== undefined) parts.push(ids.errorId);
  return parts.length > 0 ? parts.join(' ') : undefined;
}
