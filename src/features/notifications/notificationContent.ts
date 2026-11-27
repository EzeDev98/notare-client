/** Words in the notifications modal. */
export const NOTIFICATION_COPY = {
  title: 'Notifications',
  markAll: 'Mark all as read',
  loadFailed: 'Could not load notifications.',
  retryLoad: 'Retry',
  empty: {
    title: 'You are all caught up',
    description: 'Transcript updates appear here.',
  },
  buttons: { open: 'Open', retry: 'Retry' },
  labels: {
    transcript: 'Transcript',
  },
  texts: {
    transcriptReady: 'Transcript ready',
    transcriptFailed: 'Could not transcribe a clip',
    unknown: 'Something new happened',
  },
  toasts: {
    transcribing: 'Transcribing again',
    gone: 'That note is no longer available',
    failed: 'Something went wrong. Try again.',
  },
} as const;
