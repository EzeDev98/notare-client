/** The Wi-Fi-only setting for downloading voice clips. */
import { metaRepository } from '@/features/notes/local/metaRepository';
import { META_KEYS } from '@/features/notes/local/metaRow';

interface ConnectionInfo {
  type?: string;
}

export async function getWifiOnly(): Promise<boolean> {
  return (await metaRepository.get<boolean>(META_KEYS.wifiOnlyClips)) ?? false;
}

export function setWifiOnly(value: boolean): Promise<void> {
  return metaRepository.set(META_KEYS.wifiOnlyClips, value);
}

export async function mayDownloadClips(): Promise<boolean> {
  if (!(await getWifiOnly())) return true;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  return connection?.type !== 'cellular';
}
