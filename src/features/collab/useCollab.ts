import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Awareness } from 'y-protocols/awareness';
import type { Doc } from 'yjs';

import { CollabProvider, type CollabState } from '@/features/collab/CollabProvider';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useTabVisible } from '@/shared/hooks/useTabVisible';

const IDLE: CollabState = { status: 'idle', role: null };
const subscribeNothing = (): (() => void) => () => undefined;
const idleState = (): CollabState => IDLE;

interface UseCollabOptions {
  /** The server id of the note, or null for a note the server does not know yet: no live editing. */
  noteId: number | null;
  doc: Doc;
  /** The note's plain text for SNAPSHOT. Must be the same function between renders. */
  plainText: (doc: Doc) => string;
}

/**
 * Live editing for the open note. The provider exists while the note is open; the connection
 * exists only while the tab is visible and the device is online (background tabs stay quiet, D-14).
 * Leaving the note sends a last snapshot and closes the socket a few seconds later.
 */
export function useCollab({ noteId, doc, plainText }: UseCollabOptions): {
  awareness: Awareness;
  state: CollabState;
  /** Close the live channel now, for a note the person has just left. */
  release: () => void;
} {
  const awareness = useMemo(() => new Awareness(doc), [doc]);
  const [provider, setProvider] = useState<CollabProvider | null>(null);
  const online = useOnlineStatus();
  const visible = useTabVisible();

  useEffect(() => {
    if (noteId === null) return undefined;
    const created = new CollabProvider({ noteId, doc, awareness, plainText });
    setProvider(created);
    return () => {
      created.release();
      setProvider(null);
    };
  }, [noteId, doc, awareness, plainText]);

  useEffect(() => {
    if (provider === null) return;
    if (online && visible) provider.connect();
    else provider.disconnect();
  }, [provider, online, visible]);

  // After the provider's cleanup (effects clean up in order), so the "left" presence goes out first.
  useEffect(
    () => () => {
      awareness.destroy();
    },
    [awareness],
  );

  const state = useSyncExternalStore(
    provider ? provider.subscribe : subscribeNothing,
    provider ? provider.getState : idleState,
  );
  const release = useCallback(() => {
    provider?.release();
  }, [provider]);

  return { awareness, state, release };
}
