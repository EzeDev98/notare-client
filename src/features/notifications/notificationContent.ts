/** Every word the notifications modal shows (master 6.9). */
export const NOTIFICATION_COPY = {
  title: 'Notifications',
  markAll: 'Mark all as read',
  loadFailed: 'Could not load notifications.',
  retryLoad: 'Retry',
  someone: 'Someone',
  untitled: 'Untitled',
  empty: {
    title: 'You are all caught up',
    description: 'Invites and shared-note updates appear here.',
  },
  buttons: { accept: 'Accept', decline: 'Decline', open: 'Open', retry: 'Retry' },
  roles: { viewer: 'Viewer', editor: 'Editor' },
  labels: {
    connection: 'Connection',
    note: 'Shared note',
    voice: 'Voice clip',
    transcript: 'Transcript',
  },
  texts: {
    invited: (name: string): string => `${name} invited you to connect`,
    accepted: (name: string): string => `${name} accepted your invite`,
    declined: (name: string): string => `${name} declined your invite`,
    shared: (name: string, title: string): string => `${name} shared “${title}” with you`,
    access: (name: string): string => `${name} changed your access`,
    accessTo: (name: string, role: string): string => `${name} changed your access to ${role}`,
    revoked: (name: string, title: string): string =>
      `${name} removed your access to “${title}”`,
    transcriptReady: 'Transcript ready',
    transcriptFailed: 'Could not transcribe a clip',
    voiceShared: (name: string): string => `${name} shared a voice clip with you`,
    voiceAccess: (name: string): string => `${name} changed your access to a voice clip`,
    unknown: 'Something new happened',
  },
  toasts: {
    connected: (name: string): string => `You are now connected with ${name}`,
    declined: 'Invite declined',
    transcribing: 'Transcribing again',
    gone: 'That note is no longer available',
    failed: 'Something went wrong. Try again.',
  },
} as const;
