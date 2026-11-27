/** Signals sync that something changed on the device. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyLocalMutation(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

export function onLocalMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
