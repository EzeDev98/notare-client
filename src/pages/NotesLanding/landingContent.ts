import { TRASH_DAYS } from '@/core/config/timings';

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** Words on the note pane for Shared with me, Archived and Recently deleted, on a wide screen. */
export const LANDING_COPY = {
  shared: {
    lede: 'Notes other people invite you to appear here.',
    summary: (notes: number, people: number): string =>
      `${count(notes, 'note', 'notes')} from ${count(people, 'person', 'people')}.`,
    how: {
      heading: 'How sharing works',
      steps: [
        { title: 'Find people', body: 'Search by name or username and send a connection request.' },
        {
          title: 'They invite you to a note',
          body: 'Once connected, they can share any note with you.',
        },
        {
          title: 'It shows up here',
          body: 'You can read it, and edit it when they allow that.',
        },
      ],
    },
    username: {
      heading: 'Your username',
      label: 'Others can find you as',
      copy: 'Copy',
      copied: 'Username copied',
      failed: 'Could not copy your username',
    },
    people: 'Connected people',
    hint: 'Select a note on the left to read it.',
  },
  archived: {
    lede: 'Put away notes you want to keep but not see every day.',
    summary: (notes: number): string =>
      `${count(notes, 'note', 'notes')} kept out of your main list.`,
    how: {
      heading: 'How to archive a note',
      menu: ['Pin', 'Share', 'Archive', 'Delete'],
      hint: 'Open a note, then choose Archive from its menu.',
    },
    never:
      'Archived notes are never deleted. They stay searchable and you can bring them back at any time.',
    months: 'Last changed',
    unarchiveAll: 'Unarchive all',
    unarchivedAll: 'Notes moved back to your list',
    hint: 'Select a note on the left to preview it.',
  },
  deleted: {
    lede: 'A safety net for notes you removed by mistake.',
    summary: (notes: number): string => `${count(notes, 'note', 'notes')} waiting to be removed.`,
    timeline: {
      heading: 'What happens to a deleted note',
      start: 'Deleted',
      end: `Day ${String(TRASH_DAYS)}: gone`,
    },
    note: `Notes here are removed for good after ${String(TRASH_DAYS)} days. Restore anything you still need.`,
    emptyNote: `Until day ${String(TRASH_DAYS)} you can restore a note with one click. After that it is removed for good and cannot be recovered.`,
    schedule: 'Removal schedule',
    daysLeft: (n: number): string => `${count(n, 'day', 'days')} left`,
    leftLabel: (title: string): string => `Time left for ${title}`,
    restoreAll: 'Restore all',
    restoredAll: 'Notes restored',
    deleteAll: 'Delete all forever',
    hint: 'Select a note on the left to preview it.',
  },
} as const;

/** A note is flagged when it has this many days or fewer left. */
export const DELETE_SOON_DAYS = 7;
