import { COLLAB_COPY } from '@/features/collab/collabContent';
import type { MergeOutcome } from '@/features/collab/CollabProvider';

const COPY = COLLAB_COPY.merge;

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "Tolu", "Tolu and Ada", "Tolu, Ada and Sam". Nobody known gives null. */
export function joinNames(names: readonly string[]): string | null {
  const first = [...new Set(names.map(firstName).filter((name) => name !== ''))];
  if (first.length === 0) return null;
  if (first.length === 1) return first[0] ?? null;
  return `${first.slice(0, -1).join(', ')} and ${first[first.length - 1] ?? ''}`;
}

const possessive = (names: string): string => (names.endsWith('s') ? `${names}'` : `${names}'s`);

/** The toast after reconnecting (step 16i). When nobody can be named, it says "others" or "Someone". */
export function mergeMessage(outcome: MergeOutcome, names: readonly string[]): string {
  const who = joinNames(names);
  if (outcome.kind === 'saved') return COPY.saved;
  if (outcome.kind === 'merged') return COPY.merged(who === null ? COPY.others : possessive(who));
  return COPY.caughtUp(who ?? COPY.someone, outcome.words);
}
