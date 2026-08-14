/**
 * "After a local mutation (debounced)" is one of the engine's triggers
 * (architecture doc §3.8), and `outboxRepository` — every local mutation
 * that matters to sync passes through its three `enqueue*` methods, by
 * design (ADR-006, "the ledger") — is the one place that can announce it
 * accurately.
 *
 * This lives in its own dependency-free file rather than `engine.ts`
 * importing `noteRepository` or vice versa, because the natural wiring
 * (`noteRepository` notifies `engine`, which calls `pushOutbox`/
 * `pullChanges`, which import `noteRepository`) is a straight import cycle.
 * A leaf module with nothing but a `Set` breaks it: `noteRepository`
 * depends on this, `engine` depends on this, and this depends on nothing.
 */

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
