/** Whether this tab is on screen. */
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}

const read = (): boolean => document.visibilityState === 'visible';

export function useTabVisible(): boolean {
  return useSyncExternalStore(subscribe, read);
}
