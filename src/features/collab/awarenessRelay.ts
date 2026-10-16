import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
  type Awareness,
} from 'y-protocols/awareness';

import { COLLAB_AWARENESS_THROTTLE_MS } from '@/core/config/timings';
import { encodeAwareness } from '@/features/collab/collabProtocol';
import { REMOTE } from '@/features/collab/origin';

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

export interface AwarenessRelay {
  /** Presence from another person's frame. */
  receive: (payload: Uint8Array) => void;
  /** Send our own presence now, for example right after a join. */
  announce: () => void;
  /** The connection went: the other people's cursors go with it. */
  forgetRemote: () => void;
  /** Tell the others we left, and stop watching. */
  leave: () => void;
}

/**
 * Carries presence between the local Awareness and the socket. Only our own presence is sent, and
 * changes are batched, so moving the cursor cannot trip the server's frames-per-second limit.
 */
export function relayAwareness(
  awareness: Awareness,
  send: (frame: Uint8Array) => boolean,
  joined: () => boolean,
): AwarenessRelay {
  let timer: number | undefined;

  const sendOwn = (): void => {
    if (joined()) send(encodeAwareness(encodeAwarenessUpdate(awareness, [awareness.clientID])));
  };

  const onUpdate = (change: AwarenessChange, origin: unknown): void => {
    if (origin === REMOTE) return;
    const mine = [...change.added, ...change.updated, ...change.removed].includes(awareness.clientID);
    if (!mine) return;
    timer ??= window.setTimeout(() => {
      timer = undefined;
      sendOwn();
    }, COLLAB_AWARENESS_THROTTLE_MS);
  };
  awareness.on('update', onUpdate);

  return {
    receive: (payload) => {
      applyAwarenessUpdate(awareness, payload, REMOTE);
    },
    announce: sendOwn,
    forgetRemote: () => {
      const others = [...awareness.getStates().keys()].filter((id) => id !== awareness.clientID);
      if (others.length > 0) removeAwarenessStates(awareness, others, REMOTE);
    },
    leave: () => {
      awareness.off('update', onUpdate);
      window.clearTimeout(timer);
      awareness.setLocalState(null);
      send(encodeAwareness(encodeAwarenessUpdate(awareness, [awareness.clientID])));
    },
  };
}
