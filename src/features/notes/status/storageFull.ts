/** Tracks when the device has run out of space. */
import { useSyncExternalStore } from 'react';

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

export function isStorageFull(): boolean {
  return full;
}

export function useStorageFull(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function isQuotaError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'QuotaExceededError'
  );
}
