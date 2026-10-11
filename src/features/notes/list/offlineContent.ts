import { noteCount } from '@/design-system/lib/noteCount';

/** The offline banner and the toast that follows it (master 6.3). */
export const OFFLINE_COPY = {
  banner: 'You are offline. Notes are saved on this device and will sync when you are back.',
  backOnline: 'Back online.',
  backOnlineSynced: (count: number): string => `Back online. ${noteCount(count)} synced.`,
} as const;
