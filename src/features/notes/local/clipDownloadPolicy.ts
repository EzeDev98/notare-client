import { metaRepository } from '@/features/notes/local/metaRepository';
import { META_KEYS } from '@/features/notes/local/metaRow';

interface ConnectionInfo {
  type?: string;
}

/** Settings > Sync and storage: download voice clips on Wi-Fi only. Off until chosen. */
export async function getWifiOnly(): Promise<boolean> {
  return (await metaRepository.get<boolean>(META_KEYS.wifiOnlyClips)) ?? false;
}

export function setWifiOnly(value: boolean): Promise<void> {
  return metaRepository.set(META_KEYS.wifiOnlyClips, value);
}

/**
 * Whether a clip may download now. Blocked only when the person chose Wi-Fi only
 * and the browser says the connection is cellular. Many browsers do not report
 * the connection type; there the clip downloads.
 */
export async function mayDownloadClips(): Promise<boolean> {
  if (!(await getWifiOnly())) return true;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  return connection?.type !== 'cellular';
}
