import { describe, expect, it } from 'vitest';

import { conflictVersion, fieldErrors, isApiError, type ApiError } from '@/lib/http/errors';
import { parseResponse } from '@/lib/http/parse';

function jsonResponse(body: unknown, status = 200, type = 'application/json'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });
}

/** Narrows the thrown value, so assertions read against a typed error. */
async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (isApiError(error)) return error;
    // `cause` keeps the original error's stack reachable. Without it, a test
    // failure here reports only that the wrong thing was thrown, not where it
    // came from.
    throw new Error(`Expected an ApiError, got: ${String(error)}`, { cause: error });
  }
  throw new Error('Expected the promise to reject, but it resolved.');
}

describe('parseResponse — success', () => {
  it('parses a JSON body', async () => {
    const note = { id: 1, title: 'Hello', version: 0 };
    await expect(parseResponse(jsonResponse(note))).resolves.toEqual(note);
  });

  it('returns undefined for a 204, rather than failing to parse nothing', async () => {
    // DELETE /notes/{id}/permanent returns 204. `await response.json()` throws
    // an unhelpful SyntaxError here — which is how a successful delete gets
    // reported to the user as a parse failure.
    const response = new Response(null, { status: 204 });
    await expect(parseResponse(response)).resolves.toBeUndefined();
  });

  it('handles a JSON content type carrying a charset parameter', async () => {
    // Spring sends `application/json;charset=UTF-8`. A naive equality check on
    // the header fails here and falls through to treating the body as text.
    const response = jsonResponse({ ok: true }, 200, 'application/json;charset=UTF-8');
    await expect(parseResponse(response)).resolves.toEqual({ ok: true });
  });
});

describe('parseResponse — ProblemDetail', () => {
  it('extracts the standard members and exposes the rest as extensions', async () => {
    const response = jsonResponse(
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'This note was modified by someone else.',
        instance: '/api/v1/notes/42',
        currentVersion: 7,
      },
      409,
      'application/problem+json',
    );

    const error = await captureError(parseResponse(response));

    expect(error.detail).toMatchObject({
      kind: 'problem',
      status: 409,
      title: 'Conflict',
      detail: 'This note was modified by someone else.',
    });

    // currentVersion needs no special handling in the parser — it is just an
    // extension, and 3A already knows how to read one.
    expect(conflictVersion(error)).toBe(7);
  });

  it('surfaces the validation errors map from B2', async () => {
    const response = jsonResponse(
      {
        title: 'Validation Failed',
        status: 400,
        detail: 'One or more fields are invalid.',
        errors: { username: 'Too short.', email: 'Enter a valid email address.' },
      },
      400,
      'application/problem+json',
    );

    const error = await captureError(parseResponse(response));

    expect(fieldErrors(error)).toEqual({
      username: 'Too short.',
      email: 'Enter a valid email address.',
    });
  });

  it('falls back rather than discarding a ProblemDetail missing title or detail', async () => {
    /*
     * Lenient on purpose. A strict guard would reject this and fall through to
     * the generic `http` variant, throwing away whatever the server DID send —
     * including the detail string, the one part written for a human.
     */
    const response = jsonResponse({ status: 500 }, 500, 'application/problem+json');
    const error = await captureError(parseResponse(response));

    expect(error.detail.kind).toBe('problem');
  });
});

describe('parseResponse — non-ProblemDetail errors', () => {
  it("classifies Boot's default error body as http, not problem", async () => {
    // What a genuinely unhandled 500 still produces: B2 unified most errors,
    // not all of them, and the union reflects what the server actually sends.
    const response = jsonResponse(
      {
        timestamp: '2026-08-08T10:00:00.000+00:00',
        status: 500,
        error: 'Internal Server Error',
        path: '/api/v1/notes',
      },
      500,
    );

    const error = await captureError(parseResponse(response));
    expect(error.detail.kind).toBe('http');
  });

  it("handles a proxy's HTML error page without crashing", async () => {
    // Never from Spring, always possible from whatever sits in front of it.
    const response = new Response('<html><body>502 Bad Gateway</body></html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    });

    const error = await captureError(parseResponse(response));
    expect(error.detail).toMatchObject({ kind: 'http', status: 502 });
  });

  it('handles an empty error body', async () => {
    const response = new Response(null, { status: 403 });
    const error = await captureError(parseResponse(response));
    expect(error.detail).toMatchObject({ kind: 'http', status: 403, body: undefined });
  });

  it('reports malformed JSON as a parse error, not a network one', async () => {
    // Our bug or a contract change — never retried, always reported.
    const response = new Response('{ not json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const error = await captureError(parseResponse(response));
    expect(error.detail).toMatchObject({ kind: 'parse', status: 200 });
  });
});

describe('parseResponse — the fetch contract', () => {
  it('throws on an error status, which fetch itself does not', async () => {
    /*
     * The biggest adjustment coming from RestTemplate: fetch RESOLVES for a
     * 500. Its promise rejects only when the request never completed. Forget
     * the response.ok check and an error body becomes data — with the shape of
     * a ProblemDetail, silently rendered as if it were a note.
     */
    const response = jsonResponse({ status: 500 }, 500);
    await expect(parseResponse(response)).rejects.toThrow();
  });
});
