import { createContext, useContext, useSyncExternalStore } from 'react';

/** The shell bar's middle slot: where an open note puts its controls on a wide screen. */
const BarSlotContext = createContext<HTMLElement | null>(null);

export const BarSlotProvider = BarSlotContext.Provider;

export function useBarSlot(): HTMLElement | null {
  return useContext(BarSlotContext);
}

/** The same 800px as the shell's two-pane container query. */
const TWO_PANE = '(min-width: 800px)';

export function isTwoPane(): boolean {
  return window.matchMedia(TWO_PANE).matches;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(TWO_PANE);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

export function useTwoPane(): boolean {
  return useSyncExternalStore(subscribe, isTwoPane, () => false);
}
