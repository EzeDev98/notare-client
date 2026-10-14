/** The update prompt's words (master 6.7). */
export const UPDATE_COPY = {
  title: 'Update available',
  body: 'A new version of Notare is ready. Your note is saved.',
  reload: 'Reload',
  updated: (version: string): string => `Updated to version ${version}.`,
  required: {
    title: 'Update required',
    body: 'This version of Notare is too old to sync. Reload to update. Your notes stay safe on this device.',
  },
} as const;
