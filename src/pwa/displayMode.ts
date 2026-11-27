/** Whether the app is running installed. */
import { useEffect, useState } from 'react';
import { STANDALONE_RECHECK_LONG_MS, STANDALONE_RECHECK_MS } from '@/core/config/timings';

function consumePostResetStandaloneHint(): boolean {
  if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get('notare_reset_standalone') !== '1') return false;

  url.searchParams.delete('notare_reset_standalone');
  window.history.replaceState(null, '', url.toString());
  return true;
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;

  const matchesDisplayModeMediaQuery =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const iosStandaloneNavigator = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;

  return (
    matchesDisplayModeMediaQuery ||
    iosStandaloneNavigator === true ||
    consumePostResetStandaloneHint()
  );
}

export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandaloneDisplayMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => {
      const next = isStandaloneDisplayMode();
      setStandalone(next);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const recheck = () => {
      setStandalone((current) => {
        const rechecked = isStandaloneDisplayMode();
        if (rechecked === current) return current;

        return rechecked;
      });
    };

    const timers = [STANDALONE_RECHECK_MS, STANDALONE_RECHECK_LONG_MS].map((delay) =>
      setTimeout(recheck, delay),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return standalone;
}

export const EVER_STANDALONE_STORAGE_KEY = 'notare:everStandalone';

function readPersistedEverStandalone(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(EVER_STANDALONE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistEverStandalone(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EVER_STANDALONE_STORAGE_KEY, '1');
  } catch {}
}

export function useEverStandalone(): boolean {
  const isStandalone = useIsStandalone();
  const [everStandalone, setEverStandalone] = useState(
    () => isStandalone || readPersistedEverStandalone(),
  );

  useEffect(() => {
    if (isStandalone) {
      setEverStandalone(true);
      persistEverStandalone();
    }
  }, [isStandalone]);

  return everStandalone;
}
