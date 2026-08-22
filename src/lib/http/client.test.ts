import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAborted, isApiError, isOffline, isRetriable } from '@/lib/http/errors';
import { httpClient } from '@/lib/http/client';

/**
 * A stubbed fetch, capturing what the client sent.
 *
 * vi.stubGlobal rather than MSW here on purpose: these tests are about the
 * REQUEST the client constructs — the URL, the headers, the serialised body.
 * MSW arrives in 3E for tests about responses, where a realistic server is
 * what matters.
 */
let calls: { url: string; init: RequestInit }[] = [];

/**
 * Takes a FACTORY, not a Response.
 *
 * A Response body is a single-use stream (see 3B). Handing the same instance
 * to several requests means the first consumes it and every later one fails
 * with "body stream already read" — which parse.ts correctly reports as a
 * network error, since a body that cannot be read means the request did not
 * complete. Correct behaviour, confusing test failure.
 */
function stubFetch(makeResponse: () => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(makeResponse());
    }),
  );
}

function jsonOk(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function lastCall(): { url: string; init: RequestInit } {
  const call = calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return call;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL building', () => {
  it('joins the base URL and path', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes');

    // apiBaseUrl is "/api/v1" in test, matching 1D's dev proxy setup.
    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes');
  });

  it('adds a leading slash when the caller omits one', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('notes');
    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes');
  });

  it('encodes query values, so a percent sign survives the round trip', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes/search', { query: { query: '100%' } });

    /*
     * The client half of B8. The server escapes % as a LIKE wildcard; this
     * encodes it for transport. A hand-built query string sends a bare %,
     * and the server either 400s or searches for something else entirely.
     */
    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes/search?query=100%25');
  });

  it('drops undefined query values instead of sending the string "undefined"', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes', { query: { page: 0, size: undefined, archived: false } });

    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes?page=0&archived=false');
  });

  it('repeats a parameter for array values', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes', { query: { sort: ['pinned', 'updatedAt'] } });

    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes?sort=pinned&sort=updatedAt');
  });

  it('omits the question mark when there are no parameters', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes', { query: { page: undefined } });
    expect(lastCall().url).toBe('http://localhost:2001/api/v1/notes');
  });
});

describe('body and headers', () => {
  it('serialises a JSON body and sets its content type', async () => {
    stubFetch(() => jsonOk());
    await httpClient.post('/notes', { body: { content: 'Hello', pinned: true } });

    const { init } = lastCall();
    expect(init.body).toBe('{"content":"Hello","pinned":true}');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('sends no content-type on a bodyless request', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes');

    expect(lastCall().init.headers).not.toHaveProperty('content-type');
  });

  it('passes FormData through untouched, without a content-type', async () => {
    /*
     * The branch that has to exist before Step 10, not during it.
     *
     * Without it, JSON.stringify(formData) returns "{}" — an empty object
     * uploaded with no error anywhere. And a multipart body must not carry a
     * Content-Type we set: the browser generates a boundary parameter, and a
     * hand-written "multipart/form-data" omits it, so the server cannot parse
     * a request that looks perfectly well formed.
     */
    stubFetch(() => jsonOk());
    const form = new FormData();
    form.append('file', new Blob(['audio']), 'note.webm');

    await httpClient.post('/voice-notes', { body: form });

    const { init } = lastCall();
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).not.toHaveProperty('content-type');
  });

  it('always asks for JSON', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes');

    // Spring content-negotiates on Accept. This is what gets a ProblemDetail
    // back rather than an HTML error page.
    expect(lastCall().init.headers).toMatchObject({ accept: 'application/json' });
  });

  it('lets a caller override a default header', async () => {
    stubFetch(() => jsonOk());
    await httpClient.get('/notes', { headers: { accept: 'text/plain' } });

    expect(lastCall().init.headers).toMatchObject({ accept: 'text/plain' });
  });
});

describe('methods', () => {
  it('sends the right verb', async () => {
    stubFetch(() => jsonOk());

    await httpClient.get('/notes');
    expect(lastCall().init.method).toBe('GET');

    await httpClient.patch('/notes/1', { body: { content: 'x' } });
    expect(lastCall().init.method).toBe('PATCH');

    await httpClient.delete('/notes/1');
    expect(lastCall().init.method).toBe('DELETE');
  });
});

describe('failures', () => {
  it('maps a fetch rejection to a network error', async () => {
    // fetch rejects only when the request never completed — offline, DNS
    // failure, CORS refusal. All indistinguishable by design.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(httpClient.get('/notes')).rejects.toSatisfy(isApiError);
  });

  it('throws on an error status, which fetch itself does not', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ title: 'Not Found', status: 404, detail: 'Note not found.' }),
          {
            status: 404,
            headers: { 'content-type': 'application/problem+json' },
          },
        ),
    );

    await expect(httpClient.get('/notes/999')).rejects.toThrow();
  });
});

/**
 * A fetch that never resolves on its own and only settles when aborted.
 *
 * The stub has to HONOUR the signal — a stub that ignores it cannot test
 * cancellation, since the request would resolve before any abort mattered.
 * Rejecting with signal.reason is what the real fetch does.
 */
function stubHangingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          /*
           * The up-front check matters as much as the listener.
           *
           * Real fetch inspects signal.aborted BEFORE doing anything and
           * rejects immediately if it is already set. A stub with only an
           * event listener misses that case entirely: the abort event fired in
           * the past, the listener is attached too late, and the promise hangs
           * forever — which shows up as a test timeout rather than as a
           * failure, and looks like a bug in the code under test.
           */
          if (init.signal?.aborted === true) {
            const existing: unknown = init.signal.reason;
            reject(existing instanceof Error ? existing : new Error('aborted'));
            return;
          }

          init.signal?.addEventListener('abort', () => {
            /*
             * AbortSignal.reason is typed `any` in the DOM lib, so the linter
             * cannot confirm a rejection reason is an Error — and is right not
             * to assume it. At runtime it is a DOMException (AbortError for a
             * manual abort, TimeoutError for AbortSignal.timeout), so narrow
             * rather than suppress.
             */
            const reason: unknown = init.signal?.reason;
            reject(reason instanceof Error ? reason : new Error('aborted'));
          });
        }),
    ),
  );
}

describe('cancellation and timeouts', () => {
  it('reports a caller abort as aborted, not as a failure', async () => {
    stubHangingFetch();
    const controller = new AbortController();

    const promise = httpClient.get('/notes', { signal: controller.signal });
    controller.abort();

    const error = await promise.catch((e: unknown) => e);

    /*
     * `aborted` is a distinct variant precisely so callers can IGNORE it.
     * Step 6's auto-save cancels superseded saves constantly; surfacing those
     * as errors would be the bug.
     */
    expect(isAborted(error)).toBe(true);
    expect(isOffline(error)).toBe(false);
  });

  it('reports an elapsed deadline as a timeout', async () => {
    stubHangingFetch();

    const error = await httpClient.get('/notes', { timeoutMs: 10 }).catch((e: unknown) => e);

    expect(isApiError(error) && error.detail.kind).toBe('timeout');

    /*
     * Counted as offline because it means "we do not know". The abort stops US
     * waiting; the server never hears about it and finishes the transaction —
     * so a timed-out POST may well have succeeded.
     */
    expect(isOffline(error)).toBe(true);
    expect(isRetriable(error)).toBe(true);
  });

  it('prefers the caller when both the signal and the deadline fire', async () => {
    stubHangingFetch();
    const controller = new AbortController();

    const promise = httpClient.get('/notes', { signal: controller.signal, timeoutMs: 5 });
    controller.abort();

    // The user's intent is the more useful classification: aborted is
    // swallowed, timeout is surfaced and retried.
    expect(isAborted(await promise.catch((e: unknown) => e))).toBe(true);
  });

  it('rejects immediately when handed an already-aborted signal', async () => {
    stubHangingFetch();

    expect(
      isAborted(
        await httpClient.get('/notes', { signal: AbortSignal.abort() }).catch((e: unknown) => e),
      ),
    ).toBe(true);
  });

  it('does not time out a request that completes in time', async () => {
    stubFetch(() => jsonOk({ id: 1 }));

    await expect(httpClient.get('/notes/1', { timeoutMs: 1000 })).resolves.toEqual({ id: 1 });
  });
});
