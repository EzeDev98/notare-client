/** Words for People and Find people (master 6.3). */
export const PEOPLE_COPY = {
  heading: 'People',
  find: 'Find people',
  none: 'You are not connected with anyone yet. Find people to share notes with.',
  modal: {
    title: 'Find people',
    label: 'Search people',
    placeholder: 'Name or username',
    hint: 'Search by name or username.',
    none: (term: string) => `No people match “${term}”.`,
    failed: 'Could not search. Check your connection and try again.',
    done: 'Done',
  },
  toasts: {
    invited: 'Invite sent',
    cancelled: 'Invite cancelled',
    inviteFailed: 'Could not send the invite. Try again.',
    cancelFailed: 'Could not cancel the invite. Try again.',
  },
} as const;
