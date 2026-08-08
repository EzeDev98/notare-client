import { HttpResponse } from 'msw';

/**
 * Error responses in the shapes the server actually produces.
 *
 * After B2 there are two, and the distinction is not cosmetic: 3B parses them
 * differently and 3A classifies them differently. A test suite that only ever
 * sees the tidy one is testing a server we do not have.
 */

/**
 * RFC 9457 ProblemDetail — every handled exception, plus the framework's own
 * since B2 enabled spring.mvc.problemdetails.
 *
 * Extra members go at the ROOT, not nested: `currentVersion` on a conflict,
 * the `errors` map on a validation failure.
 */
export function problemDetail(
  status: number,
  options: { title?: string; detail?: string; extensions?: Record<string, unknown> } = {},
) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      title: options.title ?? 'Error',
      status,
      detail: options.detail ?? 'Something went wrong.',
      instance: '/api/v1/test',
      ...options.extensions,
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

/**
 * Boot's DEFAULT error body, which a genuinely unhandled 500 still produces.
 *
 * B2 unified most errors, not all of them. A client that assumes every failure
 * is a ProblemDetail breaks on exactly the responses that indicate the server
 * is already in trouble — the worst possible moment for a second failure.
 */
export function bootDefaultError(status: number, path = '/api/v1/notes') {
  return HttpResponse.json(
    {
      timestamp: '2026-08-08T10:00:00.000+00:00',
      status,
      error: status === 500 ? 'Internal Server Error' : 'Error',
      path,
    },
    { status },
  );
}

/** A 409 carrying the server's current version — NoteConflictException. */
export function noteConflict(currentVersion: number) {
  return problemDetail(409, {
    title: 'Conflict',
    detail: 'This note was modified by someone else.',
    extensions: { currentVersion },
  });
}

/**
 * A 409 with NO currentVersion — ObjectOptimisticLockingFailureException.
 *
 * The rarer flavour, and the one that breaks clients. It appears only under
 * genuine concurrency, so it is a nuisance to reproduce against a live server
 * and four lines as a fixture. Step 6 must refetch rather than assume the
 * field is there.
 */
export function bareConflict() {
  return problemDetail(409, { title: 'Conflict', detail: 'The note was modified concurrently.' });
}

/** A 400 with per-field messages — B2's validation handler. */
export function validationFailure(errors: Record<string, string>) {
  return problemDetail(400, {
    title: 'Validation Failed',
    detail: 'One or more fields are invalid.',
    extensions: { errors },
  });
}
