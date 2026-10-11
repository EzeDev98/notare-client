import type { NotesView } from '@/app/routes';

/** Words in the app shell: the header and the drawer (master 5.3). */
export const SHELL_COPY = {
  openMenu: 'Open menu',
  drawerName: 'Menu',
  listPane: 'Notes list',
  settings: 'Settings',
  notifications: 'Notifications',
  newNote: 'New note',
} as const;

/** The four list views in drawer order, with their labels. */
export const DRAWER_VIEWS: ReadonlyArray<{ view: NotesView; label: string }> = [
  { view: 'all', label: 'All notes' },
  { view: 'shared', label: 'Shared with me' },
  { view: 'archived', label: 'Archived' },
  { view: 'deleted', label: 'Recently deleted' },
];
