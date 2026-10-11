import type { NotesView } from '@/app/routes';

/** Words on the notes list (master 6.3). */
export const LIST_COPY = {
  /** Dates in the rows are written the way the prototype writes them. */
  locale: 'en-GB',
  listName: 'Notes',
  deletedBanner: 'Notes here are removed for good after 30 days.',
  titles: {
    all: 'Notes',
    shared: 'Shared with me',
    archived: 'Archived',
    deleted: 'Recently deleted',
  } satisfies Record<NotesView, string>,
  rowMenu: 'Note actions',
  untitled: 'Untitled',
  copySuffix: ' copy',
  toasts: {
    undo: 'Undo',
    deleted: 'Note moved to Recently deleted',
    restored: 'Note restored',
    pinned: 'Note pinned',
    unpinned: 'Note unpinned',
    archived: 'Note archived',
    unarchived: 'Note moved back to your notes',
    copied: 'Copy saved in your notes',
    left: 'You left the note',
  },
  leave: {
    title: 'Leave this note?',
    body: (title: string, owner: string | null) =>
      `You will lose access to “${title}”. ${owner?.split(' ')[0] ?? 'The owner'} can invite you again.`,
    cancel: 'Cancel',
    confirm: 'Leave',
  },
  search: {
    label: 'Search notes',
    placeholder: 'Search notes',
    clear: 'Clear search',
  },
  empty: {
    all: {
      title: 'No notes yet',
      description: 'Start writing, or record a voice clip. Notes are saved on this device first.',
    },
    shared: {
      title: 'Nothing shared with you yet',
      description: 'When someone invites you to a note, it appears here.',
    },
    archived: {
      title: 'Nothing archived',
      description: 'Archived notes stay out of your list but are never deleted.',
    },
    deleted: { title: 'Nothing deleted', description: 'Deleted notes stay here for 30 days.' },
    detail: { title: 'Select a note', description: 'Or start a new one.' },
    newNote: 'New note',
    search: (term: string) => `No notes match \u201c${term}\u201d`,
    searchHint: 'Check the spelling or try a different word.',
  },
  groups: {
    pinned: 'Pinned',
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'Previous 7 days',
    earlier: 'Earlier',
  },
} as const;
