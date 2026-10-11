import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

import { flip } from '@/design-system/motion/motion';
import { rowOut } from '@/design-system/motion/patterns';
import type { ListItem } from '@/features/notes/list/listItem';

/** A row that is gone, or a row that moved between Pinned and the rest. */
export type RowChange = 'gone' | { pinned: boolean; at: number };

export interface RowChanges {
  /** The list with the changes applied. Same array as the input while there are none. */
  shown: ListItem[] | undefined;
  /** The row fades, the rest glide into the gap, then the write runs. Delete, Archive, Leave. */
  remove: (id: string, order: readonly string[], write: () => Promise<void>) => Promise<void>;
  /** The rows glide to their new places, then the write runs. Pin, Restore. */
  change: (id: string, next: RowChange, write: () => Promise<void>) => Promise<void>;
}

/**
 * The list is a live query, so a write reaches the screen a moment later and
 * flip() could not see the move. The change is applied here first, inside
 * flip(), and dropped as soon as the database says the same thing.
 */
export function useRowChanges(
  host: RefObject<HTMLElement | null>,
  items: ListItem[] | undefined,
): RowChanges {
  const [changes, setChanges] = useState<ReadonlyMap<string, RowChange>>(() => new Map());

  const shown = useMemo(() => {
    if (!items || changes.size === 0) return items;
    const out: ListItem[] = [];
    for (const item of items) {
      const next = changes.get(item.id);
      if (next === 'gone') continue;
      out.push(next ? { ...item, pinned: next.pinned, at: next.at } : item);
    }
    return out;
  }, [items, changes]);

  useEffect(() => {
    if (!items) return;
    setChanges((prev) => {
      if (prev.size === 0) return prev;
      const byId = new Map(items.map((item) => [item.id, item]));
      const rest = new Map(prev);
      prev.forEach((next, id) => {
        const item = byId.get(id);
        const done = next === 'gone' ? !item : !item || item.pinned === next.pinned;
        if (done) rest.delete(id);
      });
      return rest.size === prev.size ? prev : rest;
    });
  }, [items]);

  const record = useCallback((id: string, next: RowChange | null) => {
    setChanges((prev) => {
      const out = new Map(prev);
      if (next) out.set(id, next);
      else out.delete(id);
      return out;
    });
  }, []);

  const apply = useCallback(
    (id: string, next: RowChange) => {
      flushSync(() => {
        record(id, next);
      });
    },
    [record],
  );

  const remove = useCallback<RowChanges['remove']>(
    async (id, order, write) => {
      const parent = host.current?.querySelector('.n-list') ?? null;
      const row = parent?.querySelectorAll(':scope > .n-row')[order.indexOf(id)];
      try {
        if (parent && row) {
          await rowOut(row, parent, () => {
            apply(id, 'gone');
          });
        } else {
          apply(id, 'gone');
        }
        await write();
      } catch (error) {
        record(id, null);
        throw error;
      }
    },
    [host, apply, record],
  );

  const change = useCallback<RowChanges['change']>(
    async (id, next, write) => {
      const parent = host.current?.querySelector('.n-list') ?? null;
      try {
        if (parent) {
          flip(parent, () => {
            apply(id, next);
          });
        } else {
          apply(id, next);
        }
        await write();
      } catch (error) {
        record(id, null);
        throw error;
      }
    },
    [host, apply, record],
  );

  return { shown, remove, change };
}
