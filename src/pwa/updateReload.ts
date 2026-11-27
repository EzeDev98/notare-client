/** Remembers that the next load is an update reload. */
const KEY = 'notare.updated';

export function markUpdateReload(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {}
}

export function clearUpdateReload(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function consumeUpdateReload(): boolean {
  try {
    const marked = sessionStorage.getItem(KEY) !== null;
    sessionStorage.removeItem(KEY);
    return marked;
  } catch {
    return false;
  }
}
