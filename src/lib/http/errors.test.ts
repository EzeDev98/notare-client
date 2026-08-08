import { describe, expect, it } from 'vitest';

import {
  ApiError,
  conflictVersion,
  fieldErrors,
  isAborted,
  isApiError,
  isConflict,
  isOffline,
  isRetriable,
  isUnauthorized,
  statusOf,
} from '@/lib/http/errors';

function problem(status: number, extensions: Record<string, unknown> = {}): ApiError {
  return new ApiError({
    kind: 'problem',
    status,
    title: 'Test',
    detail: 'Test detail',
    extensions,
  });
}

describe('ApiError', () => {
  it('is a real Error, so it carries a stack', () => {
    const error = new ApiError({ kind: 'network' });

    // The reason for a class rather than a plain object: a thrown
    // { kind: 'network' } works and reports nothing useful in production.
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.stack).toBeDefined();
  });

  it('recognises its own instances and rejects everything else', () => {
    expect(isApiError(new ApiError({ kind: 'timeout' }))).toBe(true);

    // JavaScript can throw anything, which is why catch gives you `unknown`.
    expect(isApiError(new Error('plain'))).toBe(false);
    expect(isApiError('a string')).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });
});

describe('statusOf', () => {
  it('returns undefined for transport failures, which have no status', () => {
    expect(statusOf(new ApiError({ kind: 'network' }))).toBeUndefined();
    expect(statusOf(problem(404))).toBe(404);
  });
});

describe('conflictVersion', () => {
  it('reads currentVersion when the server sent one', () => {
    expect(conflictVersion(problem(409, { currentVersion: 7 }))).toBe(7);
  });

  it('returns undefined for a conflict WITHOUT currentVersion', () => {
    /*
     * The path that only appears under real concurrency:
     * ObjectOptimisticLockingFailureException produces a 409 carrying no
     * currentVersion at all. A client assuming the field is always present
     * crashes exactly when two people are editing — the moment it matters most.
     */
    expect(isConflict(problem(409))).toBe(true);
    expect(conflictVersion(problem(409))).toBeUndefined();
  });

  it('ignores a non-numeric currentVersion rather than trusting it', () => {
    expect(conflictVersion(problem(409, { currentVersion: '7' }))).toBeUndefined();
  });
});

describe('fieldErrors', () => {
  it('extracts the errors map from a validation failure', () => {
    const error = problem(400, {
      errors: { username: 'Too short.', email: 'Invalid.' },
    });

    expect(fieldErrors(error)).toEqual({ username: 'Too short.', email: 'Invalid.' });
  });

  it('drops non-string values instead of rendering them', () => {
    // Otherwise a contract change puts "[object Object]" under an input.
    const error = problem(400, { errors: { username: 'Too short.', age: 42 } });
    expect(fieldErrors(error)).toEqual({ username: 'Too short.' });
  });

  it('returns undefined when errors is missing or the wrong shape', () => {
    expect(fieldErrors(problem(400))).toBeUndefined();
    expect(fieldErrors(problem(400, { errors: 'nope' }))).toBeUndefined();
    expect(fieldErrors(problem(400, { errors: ['a', 'b'] }))).toBeUndefined();
  });
});

describe('classification helpers', () => {
  it('treats 401 as unauthorized, which is what triggers refresh in Step 4', () => {
    expect(isUnauthorized(problem(401))).toBe(true);
    expect(isUnauthorized(problem(403))).toBe(false);
  });

  it('counts network and timeout as offline, so Step 8 can queue them', () => {
    expect(isOffline(new ApiError({ kind: 'network' }))).toBe(true);

    // A timeout counts: we do not know whether the server received it, and
    // the sync protocol's operationId makes replaying safe either way.
    expect(isOffline(new ApiError({ kind: 'timeout' }))).toBe(true);
    expect(isOffline(problem(500))).toBe(false);
  });

  it('identifies cancellation, which callers should swallow', () => {
    expect(isAborted(new ApiError({ kind: 'aborted' }))).toBe(true);
  });

  it('retries 5xx and transport failures, never 4xx', () => {
    expect(isRetriable(problem(503))).toBe(true);
    expect(isRetriable(new ApiError({ kind: 'network' }))).toBe(true);

    // Retrying a 400 forever is a classic client-side loop, and one the
    // server cannot defend against.
    expect(isRetriable(problem(400))).toBe(false);
    expect(isRetriable(problem(409))).toBe(false);
  });
});
