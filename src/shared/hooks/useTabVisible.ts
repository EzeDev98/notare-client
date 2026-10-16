import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}

const read = (): boolean => document.visibilityState === 'visible';

/** Whether this tab is on screen. Background tabs stay quiet (D-14). */
export function useTabVisible(): boolean {
  return useSyncExternalStore(subscribe, read);
}
