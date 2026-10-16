import { useEffect, useRef } from 'react';

import { MERGE_TOAST_DELAY_MS } from '@/core/config/timings';
import { useToast } from '@/design-system/ui';
import type { CollabState } from '@/features/collab/CollabProvider';
import { mergeMessage } from '@/features/collab/mergeMessage';
import type { PresentPerson } from '@/features/collab/usePresencePeople';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

/**
 * After the connection comes back and the note has synced, says what happened (step 16i).
 * The toast waits a moment, so the people who are in the note again have been seen and can be named.
 */
export function useMergeToast(state: CollabState | undefined, people: readonly PresentPerson[]): void {
  const { toast } = useToast();
  const settled = useDebouncedValue(state?.merge, MERGE_TOAST_DELAY_MS);
  const names = useRef<readonly string[]>([]);
  const shown = useRef(0);

  useEffect(() => {
    names.current = people.map((person) => person.name);
  }, [people]);

  useEffect(() => {
    if (settled === undefined || settled.id === shown.current) return;
    shown.current = settled.id;
    toast(mergeMessage(settled, names.current), { tone: settled.kind === 'caughtUp' ? 'neutral' : 'success' });
  }, [settled, toast]);
}
