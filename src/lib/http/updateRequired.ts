/** Records that the server needs a newer app version. */
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
