/** A live database query that only re-renders when its result changes. */
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
