/** All words for the status banner and its sign-in modal (master 6.7, step 14). */
export const STATUS_COPY = {
  sessionExpired: {
    title: 'Your session expired',
    body: 'Your notes are safe on this device. Sign in to keep them synced.',
    action: 'Sign in',
  },
  syncPaused: {
    title: 'Sync paused',
    body: 'We could not reach the server. Your notes are safe on this device and we will try again soon.',
    action: 'Retry',
    stillFailing: 'Cannot reach the server. Check your connection and try again.',
    recovered: 'Back in sync.',
  },
  deviceFull: {
    title: 'This device is full',
    body: 'New changes cannot be saved. Free up space to keep writing.',
    action: 'Free up space',
  },
  noSpaceToRecord: 'No space left on this device. Free up space to record.',
  signIn: {
    title: 'Sign in again',
    note: 'Your notes stay on this device while you sign in.',
    username: 'Username',
    password: 'Password',
    passwordRequired: 'Password is required.',
    wrongPassword: 'Incorrect password.',
    cannotReach: 'Cannot reach the server. Check your connection and try again.',
    failed: 'Something went wrong. Try again.',
    cancel: 'Cancel',
    submit: 'Sign in',
    done: 'Signed in. Your changes are syncing.',
  },
} as const;
