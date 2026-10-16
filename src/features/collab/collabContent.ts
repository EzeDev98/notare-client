/** All words for live collaboration (step 16). */
export const COLLAB_COPY = {
  peopleMenu: 'People in this note',
  editing: 'editing',
  viewing: 'viewing',
  merge: {
    merged: (who: string) => `Your changes were merged with ${who} edits.`,
    saved: 'Your changes were saved and synced.',
    caughtUp: (who: string, words: number) =>
      `Caught up. ${who} added ${String(words)} ${words === 1 ? 'word' : 'words'} while you were offline.`,
    others: "others'",
    someone: 'Someone',
  },
  leaveFailed: 'Could not leave the note. Try again.',
  share: {
    title: 'Share',
    addLabel: 'Add people',
    placeholder: 'Name or username',
    hint: 'They get Viewer access until you change it.',
    none: (term: string) => `No connected people match “${term}”.`,
    alreadyHasAccess: 'This person already has access.',
    you: 'You',
    owner: 'Owner',
    roleFor: (name: string) => `Role for ${name}`,
    roles: { viewer: 'Viewer', editor: 'Editor', remove: 'Remove access' },
    loadFailed: 'Could not load who has access. Check your connection and try again.',
    done: 'Done',
    toasts: {
      shared: (name: string) => `Shared with ${name}`,
      removed: (name: string) => `${name} no longer has access`,
      canEdit: (name: string) => `${name} can now edit`,
      offline: 'Cannot reach the server. Check your connection and try again.',
      failed: 'Could not update sharing. Try again.',
    },
  },
} as const;
