/** Builders for the error responses the server sends. */
import { HttpResponse } from 'msw';

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

export function noteConflict(currentVersion: number) {
  return problemDetail(409, {
    title: 'Conflict',
    detail: 'This note was modified by someone else.',
    extensions: { currentVersion },
  });
}

export function bareConflict() {
  return problemDetail(409, { title: 'Conflict', detail: 'The note was modified concurrently.' });
}

export function validationFailure(errors: Record<string, string>) {
  return problemDetail(400, {
    title: 'Validation Failed',
    detail: 'One or more fields are invalid.',
    extensions: { errors },
  });
}
