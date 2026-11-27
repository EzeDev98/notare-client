import { LIST_COPY } from './listContent';
import type { ListItem } from './listItem';

export const GROUP_ORDER = ['pinned', 'today', 'yesterday', 'week', 'earlier'] as const;
export type NoteGroup = (typeof GROUP_ORDER)[number];

export interface Section {
  group: NoteGroup;
  items: ListItem[];
}

const TIME = new Intl.DateTimeFormat(LIST_COPY.locale, { hour: '2-digit', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat(LIST_COPY.locale, { weekday: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat(LIST_COPY.locale, { day: 'numeric', month: 'short' });

/** Midnight, `daysAgo` calendar days before `now`, in the person's time zone. */
function dayStart(now: number, daysAgo: number): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - daysAgo);
  return day.getTime();
}

export function groupOf(item: Pick<ListItem, 'pinned' | 'at'>, now: number): NoteGroup {
  if (item.pinned) return 'pinned';
  if (item.at >= dayStart(now, 0)) return 'today';
  if (item.at >= dayStart(now, 1)) return 'yesterday';
  if (item.at >= dayStart(now, 7)) return 'week';
  return 'earlier';
}

/** The date on the right of a row: the time for Pinned and Today, then Yesterday, the weekday, the date. */
export function rowDate(item: Pick<ListItem, 'pinned' | 'at'>, now: number): string {
  switch (groupOf(item, now)) {
    case 'pinned':
    case 'today':
      return TIME.format(item.at);
    case 'yesterday':
      return LIST_COPY.groups.yesterday;
    case 'week':
      return WEEKDAY.format(item.at);
    case 'earlier':
      return DAY_MONTH.format(item.at);
  }
}

/** Newest first, grouped. */
export function sectionsFor(items: readonly ListItem[], now: number): Section[] {
  const recent = [...items].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  return GROUP_ORDER.map((group) => ({
    group,
    items: recent.filter((item) => groupOf(item, now) === group),
  })).filter((section) => section.items.length > 0);
}
