import { env } from '@/lib/config/env';

/**
 * The one place server timestamps are interpreted (decision D8).
 *
 * THE API SENDS TWO KINDS, and they are not interchangeable:
 *
 *   Instant        session createdAt/lastUsedAt/expiresAt. Real UTC, with a Z.
 *                  "2026-08-08T10:00:00Z" — new Date() is CORRECT.
 *
 *   LocalDateTime  everything else: notes, shares, notifications.
 *                  "2026-08-08T10:00:00.000" — no zone, no offset.
 *                  new Date() parses it as LOCAL time, which happens to agree
 *                  with the server for a user in the database's timezone and
 *                  is silently wrong by the offset for everyone else.
 *
 * Only the Instant helpers exist yet, because sessions are the first screen to
 * display a timestamp. The LocalDateTime side lands in 5B with the note list —
 * see the note at the bottom for why it needs more than a parse.
 */

/**
 * "2 hours ago", "yesterday", "last month".
 *
 * Intl.RelativeTimeFormat rather than a date library: it is built in, it
 * localises, and it handles the awkward cases ("yesterday" rather than "1 day
 * ago") that a hand-rolled version gets subtly wrong. No dependency for a
 * problem the platform already solved.
 */
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

/** Relative time for an Instant (a timestamp WITH a zone). */
export function formatInstantRelative(instant: string, now: Date = new Date()): string {
  const then = new Date(instant);

  // An unparseable timestamp must not render "Invalid Date" or NaN at the
  // user. Falling back to the raw value is ugly and at least truthful.
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

/** Full date and time for an Instant, for a title attribute or a detail row. */
export function formatInstantAbsolute(instant: string): string {
  const then = new Date(instant);
  if (Number.isNaN(then.getTime())) return instant;

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    then,
  );
}

/* ===========================================================================
 * LocalDateTime — the zoneless kind, which is most of the API
 * ======================================================================== */

/**
 * The offset, in minutes, that the server's zone was at a given instant.
 *
 * Computed through Intl rather than hardcoded, so DST is handled. Lagos has
 * none today; a server that moves, or a zone that gains DST, would otherwise
 * be wrong for half the year with nothing to indicate it.
 */
function serverOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.serverTimeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(at);

  // "GMT+01:00", or plain "GMT" at zero offset.
  const label = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

/**
 * Turns a zoneless server timestamp into a real Date.
 *
 * "2026-08-08T10:00:00.000" means ten in the morning IN THE SERVER'S ZONE. The
 * naive `new Date(value)` reads it as ten in the morning wherever the USER is
 * — which agrees for someone in the same zone and is off by the offset for
 * everyone else. That is the bug this exists to prevent, and it is invisible
 * during development in Lagos.
 *
 * The offset is resolved twice: once against a provisional reading, then
 * against the corrected one. A single pass picks the wrong side of a DST
 * transition for timestamps within an hour of it.
 */
export function parseServerDateTime(value: string): Date | null {
  // Appending Z reads the wall-clock digits AS IF they were UTC, giving a
  // provisional instant to resolve the offset against.
  const provisional = new Date(`${value}Z`);
  if (Number.isNaN(provisional.getTime())) return null;

  const firstPass = new Date(provisional.getTime() - serverOffsetMinutes(provisional) * 60_000);
  const corrected = new Date(provisional.getTime() - serverOffsetMinutes(firstPass) * 60_000);
  return corrected;
}

/**
 * The reverse of parseServerDateTime: a Date as the server's zoneless
 * wall-clock string ("2026-08-08T10:00:00.000").
 */
export function toServerDateTime(date: Date): string {
  return new Date(date.getTime() + serverOffsetMinutes(date) * 60_000).toISOString().slice(0, -1);
}

/** Relative time for a zoneless server timestamp. */
export function formatServerDateTimeRelative(value: string, now: Date = new Date()): string {
  const parsed = parseServerDateTime(value);
  if (parsed === null) return value;
  return formatInstantRelative(parsed.toISOString(), now);
}

/** Full date and time for a zoneless server timestamp. */
export function formatServerDateTimeAbsolute(value: string): string {
  const parsed = parseServerDateTime(value);
  if (parsed === null) return value;
  return formatInstantAbsolute(parsed.toISOString());
}

/*
 * NOT COVERED HERE, deliberately: the SYNC CURSOR.
 *
 * It is a LocalDateTime too, but it is not a timestamp to display — it is an
 * opaque token the server hands us and expects back byte for byte. Parse one
 * with the function above, re-serialise it, and you send UTC where the server
 * expects its own wall clock: the cursor shifts by the offset and changes are
 * permanently skipped. Step 8 stores it as a plain string and never brings it
 * near this module.
 *
 * BACKLOG — the proper fix is the server serialising Instant everywhere, which
 * removes the guesswork entirely. It is bigger than it looks: entity field
 * types change across every module, it needs a migration, AND it breaks the
 * sync cursor, which Spring parses back as a LocalDateTime. Whoever picks it
 * up should handle the cursor separately.
 */
