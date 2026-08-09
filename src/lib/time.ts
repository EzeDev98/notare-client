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

/*
 * COMING IN 5B — parsing LocalDateTime.
 *
 * It is not simply `new Date(value + 'Z')`. That assumes the server's clock is
 * UTC, and the dev datasource is configured with serverTimezone=Africa/Lagos.
 * The honest options are: ask the backend to serialise Instant everywhere (the
 * real fix), or pick an assumed server zone and convert explicitly. Either way
 * it is a decision, not a helper — so it waits until there is a screen that
 * forces it.
 *
 * The rule that holds regardless: a SYNC CURSOR of this type is opaque. Parse
 * one into a Date and re-serialise it and you shift it by the local offset,
 * permanently skipping changes.
 */
