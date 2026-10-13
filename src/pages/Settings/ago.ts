import { SETTINGS_COPY } from './settingsContent';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** "Just now", "12 min ago", "3 h ago", "2 days ago". */
export function ago(thenMs: number, nowMs: number): string {
  const words = SETTINGS_COPY.ago;
  const minutes = Math.floor((nowMs - thenMs) / MINUTE_MS);
  if (minutes < 1) return words.justNow;
  if (minutes < MINUTES_PER_HOUR) return words.minutes(minutes);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return words.hours(hours);
  return words.days(Math.floor(hours / HOURS_PER_DAY));
}
