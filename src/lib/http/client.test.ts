/** Tests for client. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAborted, isApiError, isOffline, isRetriable } from '@/lib/http/errors';
import { httpClient } from '@/lib/http/client';

let calls: { url: string; init: RequestInit }[] = [];

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

function stubHangingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init.signal?.aborted === true) {
            const existing: unknown = init.signal.reason;
            reject(existing instanceof Error ? existing : new Error('aborted'));
            return;
          }

          init.signal?.addEventListener('abort', () => {
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

    expect(isAborted(error)).toBe(true);
    expect(isOffline(error)).toBe(false);
  });

  it('reports an elapsed deadline as a timeout', async () => {
    stubHangingFetch();

    const error = await httpClient.get('/notes', { timeoutMs: 10 }).catch((e: unknown) => e);

    expect(isApiError(error) && error.detail.kind).toBe('timeout');

    expect(isOffline(error)).toBe(true);
    expect(isRetriable(error)).toBe(true);
  });

  it('prefers the caller when both the signal and the deadline fire', async () => {
    stubHangingFetch();
    const controller = new AbortController();

    const promise = httpClient.get('/notes', { signal: controller.signal, timeoutMs: 5 });
    controller.abort();

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
