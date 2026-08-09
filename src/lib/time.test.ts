import { describe, expect, it } from 'vitest';

import { formatInstantRelative, parseServerDateTime } from '@/lib/time';

describe('parseServerDateTime', () => {
  it('reads a zoneless timestamp as the SERVER zone, not the browser zone', () => {
    /*
     * The whole point. "10:00" from the server means ten in the morning in
     * Africa/Lagos (UTC+1), which is 09:00 UTC.
     *
     * The naive new Date("2026-08-08T10:00:00.000") reads it as ten in the
     * morning wherever the USER is — correct in Lagos, wrong by the offset
     * everywhere else, and invisible while developing in Lagos.
     */
    const parsed = parseServerDateTime('2026-08-08T10:00:00.000');
    expect(parsed?.toISOString()).toBe('2026-08-08T09:00:00.000Z');
  });

  it('returns null for an unparseable value rather than an Invalid Date', () => {
    // Invalid Date propagates as NaN and renders as "Invalid Date" at the user.
    expect(parseServerDateTime('not a timestamp')).toBeNull();
  });
});

describe('formatInstantRelative', () => {
  it('describes the recent past', () => {
    const now = new Date('2026-08-08T12:00:00Z');
    expect(formatInstantRelative('2026-08-08T10:00:00Z', now)).toBe('2 hours ago');
  });

  it('falls back to the raw value rather than rendering NaN', () => {
    expect(formatInstantRelative('nonsense')).toBe('nonsense');
  });
});
