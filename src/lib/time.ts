/** Parses and formats server timestamps. */
import { env } from '@/lib/config/env';

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function formatInstantRelative(instant: string, now: Date = new Date()): string {
  const then = new Date(instant);

  if (Number.isNaN(then.getTime())) return instant;

  let duration = (then.getTime() - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return RELATIVE.format(Math.round(duration), 'year');
}

export function formatInstantAbsolute(instant: string): string {
  const then = new Date(instant);
  if (Number.isNaN(then.getTime())) return instant;

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    then,
  );
}

function serverOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.serverTimeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(at);

  const label = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

export function parseServerDateTime(value: string): Date | null {
  const provisional = new Date(`${value}Z`);
  if (Number.isNaN(provisional.getTime())) return null;

  const firstPass = new Date(provisional.getTime() - serverOffsetMinutes(provisional) * 60_000);
  const corrected = new Date(provisional.getTime() - serverOffsetMinutes(firstPass) * 60_000);
  return corrected;
}

export function toServerDateTime(date: Date): string {
  return new Date(date.getTime() + serverOffsetMinutes(date) * 60_000).toISOString().slice(0, -1);
}

export function formatServerDateTimeRelative(value: string, now: Date = new Date()): string {
  const parsed = parseServerDateTime(value);
  if (parsed === null) return value;
  return formatInstantRelative(parsed.toISOString(), now);
}

export function formatServerDateTimeAbsolute(value: string): string {
  const parsed = parseServerDateTime(value);
  if (parsed === null) return value;
  return formatInstantAbsolute(parsed.toISOString());
}
