import { useLiveQuery } from 'dexie-react-hooks';

import { isPinSet } from './pinStore';

/** Is the PIN lock on? `undefined` until the device has answered. Follows changes as they happen. */
export function usePinEnabled(): boolean | undefined {
  return useLiveQuery(() => isPinSet(), []);
}
