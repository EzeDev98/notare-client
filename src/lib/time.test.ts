/** Tests for time. */
import { describe, expect, it } from 'vitest';

import { formatInstantRelative, parseServerDateTime } from '@/lib/time';

describe('parseServerDateTime', () => {
  it('reads a zoneless timestamp as the SERVER zone, not the browser zone', () => {
    const parsed = parseServerDateTime('2026-08-08T10:00:00.000');
    expect(parsed?.toISOString()).toBe('2026-08-08T09:00:00.000Z');
  });

  it('returns null for an unparseable value rather than an Invalid Date', () => {
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
