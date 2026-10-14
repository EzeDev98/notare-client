import { getAuthHooks } from '@/lib/http/authHooks';
import { env } from '@/lib/config/env';
import { ApiError, UPDATE_REQUIRED_STATUS } from '@/lib/http/errors';
import { parseResponse } from '@/lib/http/parse';
import { signalUpdateRequired } from '@/lib/http/updateRequired';
import { HTTP_TIMEOUT_MS } from '@/core/config/timings';

/**
 * The one place this application speaks HTTP.
 */

type QueryValue = string | number | boolean | undefined | (string | number)[];

export interface RequestConfig {
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Set false to send no Authorization header and skip the 401 interceptor.
   *
   * ONE endpoint needs this: POST /auth/refresh. That request runs INSIDE the
   * refresh lock, and Web Locks are not reentrant — a 401 on it would try to
   * acquire a lock it already holds and hang forever, with no error to explain
   * why the app stopped.
   *
   * Everything else is safe by construction: login and register simply get no
   * header when there is no session, and a 401 from them finds no stored token
   * to refresh with, so recovery declines and the error surfaces normally.
   */
  auth?: boolean;
}

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised === '' ? '' : `?${serialised}`;
}

/** String concatenation, not new URL(): our dev base is relative (1D). */
function buildUrl(path: string, query: Record<string, QueryValue> | undefined): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalised}${buildQuery(query)}`;
}

function prepareBody(body: unknown): { body: BodyInit | null; headers: Record<string, string> } {
  if (body === undefined) {
    // null, not undefined: RequestInit.body is BodyInit | null, and under
    // exactOptionalPropertyTypes the two are not interchangeable.
    return { body: null, headers: {} };
  }

  if (body instanceof FormData) {
    // No content-type: the browser generates the multipart boundary, and a
    // hand-written header omits it.
    return { body, headers: {} };
  }

  return { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
}

async function request<T>(method: string, path: string, config: RequestConfig = {}): Promise<T> {
  const requiresAuth = config.auth ?? true;
  const prepared = prepareBody(config.body);
  const hooks = requiresAuth ? getAuthHooks() : null;

  const timeoutSignal = AbortSignal.timeout(config.timeoutMs ?? HTTP_TIMEOUT_MS);
  const signal = config.signal ? AbortSignal.any([config.signal, timeoutSignal]) : timeoutSignal;

  /**
   * One attempt. Reads the Authorization header fresh each time, so the retry
   * carries the NEW token rather than replaying the rejected one.
   *
   * Returns the header it used, so a 401 can report which token was refused.
   */
  async function attempt(): Promise<{ response: Response; authorization: string | null }> {
    /*
     * PROACTIVE REFRESH. getAuthorization refreshes if the token is near
     * expiry, so most requests never see a 401 at all — fewer failures, and on
     * this server fewer chances for two requests to race into two refreshes.
     *
     * This await is also the entire queueing mechanism. §12 asks that
     * concurrent requests wait on ONE refresh; they do, because they all await
     * the same Web Lock inside this call. The queue people hand-roll is what
     * the lock already is.
     */
    const authorization = hooks ? await hooks.getAuthorization() : null;

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...prepared.headers,
      ...(authorization !== null ? { authorization } : {}),
      ...config.headers,
    };

    try {
      const response = await fetch(buildUrl(path, config.query), {
        method,
        headers,
        body: prepared.body,
        signal,
      });
      return { response, authorization };
    } catch {
      // Caller cancelled beats our deadline: `aborted` is swallowed silently,
      // `timeout` is surfaced and retried.
      if (config.signal?.aborted === true) throw new ApiError({ kind: 'aborted' });
      if (timeoutSignal.aborted) throw new ApiError({ kind: 'timeout' });

      // fetch rejects only when the request never completed. Offline, DNS
      // failure and CORS refusal are indistinguishable by design.
      throw new ApiError({ kind: 'network' });
    }
  }

  // `response` is reassigned on retry; `authorization` is not — the retry
  // reads a fresh header inside attempt() rather than carrying this one.
  const first = await attempt();
  let response = first.response;
  const authorization = first.authorization;

  /*
   * 401 -> recover -> RETRY EXACTLY ONCE.
   *
   * Checked before parseResponse, because parsing consumes the body and a
   * retried request needs to discard this response wholesale anyway.
   *
   * Once, not "until it works". A second 401 after a successful refresh means
   * the token is not the problem — the endpoint genuinely refuses — and
   * retrying again is a loop the server cannot defend against.
   *
   * This is only reachable because B2 added an AuthenticationEntryPoint.
   * Before it an expired token produced an EMPTY 403, indistinguishable from a
   * real permission denial, and no refresh loop could be built on that.
   */
  if (response.status === 401 && hooks) {
    if (await hooks.recoverFromUnauthorized(authorization)) {
      ({ response } = await attempt());
    }
  }

  // Too old to talk to the server: tell the app, which blocks with "Update required" (14e).
  if (response.status === UPDATE_REQUIRED_STATUS) signalUpdateRequired();

  return parseResponse<T>(response);
}

export const httpClient = {
  get: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('GET', path, config),
  post: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('POST', path, config),
  put: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('PUT', path, config),
  patch: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('PATCH', path, config),
  delete: <T>(path: string, config?: RequestConfig): Promise<T> =>
    request<T>('DELETE', path, config),
};
