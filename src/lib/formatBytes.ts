/** "42 MB" or "1.5 GB". */
const MB = 1024 * 1024;
const GB = 1024 * MB;

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  return `${String(bytes > 0 ? Math.max(1, Math.round(bytes / MB)) : 0)} MB`;
}
