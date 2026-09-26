import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Drop-in replacement for dexie-react-hooks' useLiveQuery.
 *
 * Any IndexedDB write fires every live query watching that table, and each
 * re-emission hands back brand-new objects even when the data is identical.
 * That re-renders (and can re-key or re-animate) whatever reads them, which
 * shows up as blinks and jumps after a sync or network response. This keeps
 * the PREVIOUS reference whenever the new result is deeply equal, so React
 * bails out and nothing repaints unless the data truly changed.
 */
export function useStableLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: unknown[],
): T | undefined;
export function useStableLiveQuery<T, TDefault>(
  querier: () => T | Promise<T>,
  deps: unknown[],
  defaultResult: TDefault,
): T | TDefault;
export function useStableLiveQuery<T, TDefault>(
  querier: () => T | Promise<T>,
  deps: unknown[] = [],
  defaultResult?: TDefault,
): T | TDefault | undefined {
  const result = useLiveQuery(querier, deps, defaultResult);
  const stableRef = useRef<T | TDefault | undefined>(result);

  if (!deepEqual(stableRef.current, result)) {
    stableRef.current = result;
  }

  return stableRef.current;
}
