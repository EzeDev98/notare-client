/** Words on the notes list (master 6.3). */
export const LIST_COPY = {
  /** Dates in the rows are written the way the prototype writes them. */
  locale: 'en-GB',
  listName: 'Notes',
  title: 'Notes',
  rowMenu: 'Note actions',
  untitled: 'Untitled',
  copySuffix: ' copy',
  toasts: {
    deleted: 'Note deleted',
    pinned: 'Note pinned',
    unpinned: 'Note unpinned',
    copied: 'Copy saved in your notes',
  },
  deleteNote: {
    title: 'Delete this note forever?',
    body: 'The note and its voice clips are removed from every device. This cannot be undone.',
    confirm: 'Delete forever',
    failed: 'The note could not be deleted. Try again.',
  },
  search: {
    label: 'Search notes',
    placeholder: 'Search notes',
    clear: 'Clear search',
  },
  empty: {
    all: {
      title: 'No notes yet',
      description: 'Start writing, or record a voice clip. Notes\nare saved on this device first.',
    },
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
