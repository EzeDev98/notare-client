const KEY = 'notare.updated';

/** Remembers that the next load is an update reload, so it can say so. Per tab. */
export function markUpdateReload(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage is unavailable: the reload still works, only the toast is lost.
  }
}

export function clearUpdateReload(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True once after an update reload. */
export function consumeUpdateReload(): boolean {
  try {
    const marked = sessionStorage.getItem(KEY) !== null;
    sessionStorage.removeItem(KEY);
    return marked;
  } catch {
    return false;
  }
}
