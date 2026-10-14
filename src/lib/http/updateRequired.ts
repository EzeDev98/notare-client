/**
 * Set once the server says this version of the app is too old (HTTP 426). A plain
 * store, so lib/ needs no React; the app reads it with useSyncExternalStore.
 */
let required = false;
const listeners = new Set<() => void>();

export function signalUpdateRequired(): void {
  if (required) return;
  required = true;
  for (const listener of listeners) listener();
}

export function getUpdateRequired(): boolean {
  return required;
}

export function subscribeUpdateRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
