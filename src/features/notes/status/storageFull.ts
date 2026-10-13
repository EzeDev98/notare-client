import { useSyncExternalStore } from 'react';

/**
 * "This device is full" — set when a write to Dexie fails with a quota error,
 * cleared by the next write that works. One flag for the whole app, because
 * when the disk is full no note is safe.
 */
let full = false;
const listeners = new Set<() => void>();

export function setStorageFull(value: boolean): void {
  if (full === value) return;
  full = value;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return full;
}

/** Is the device full right now? For code that is not a component. */
export function isStorageFull(): boolean {
  return full;
}

export function useStorageFull(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True for the browser's (and Dexie's) out-of-space error. */
export function isQuotaError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'QuotaExceededError'
  );
}
