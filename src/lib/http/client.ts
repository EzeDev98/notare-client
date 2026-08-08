import { env } from '@/lib/config/env';
import { ApiError } from '@/lib/http/errors';
import { parseResponse } from '@/lib/http/parse';

/**
 * The one place this application speaks HTTP.
 *
 * §10: no fetch() inside a component. Scattered fetch calls mean the auth
 * header is attached in forty places, so Step 4's refresh has forty places to
 * hook; the base URL becomes a repeated literal; and every call site invents
 * its own error handling, so the same 409 behaves differently depending on
 * which component made the request.
 */

/**
 * Default deadline.
 *
 * fetch has NO timeout of its own — a request can hang indefinitely, and on a
 * mobile connection that drops mid-request it usually does: the connection is
 * never closed, no error fires, the promise never settles. Without this, the
 * UI sits on a spinner with nothing to retry and nothing to report.
 *
 * 15s is generous for this API. Step 6's auto-save will want much less (a save
 * that has not landed in five seconds should say "offline" rather than keep
 * pretending), and Step 10's voice upload much more.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

/** A value that can appear in a query string. undefined means "omit". */
type QueryValue = string | number | boolean | undefined | (string | number)[];

export interface RequestConfig {
  /** Appended as a query string. undefined values are dropped. */
  query?: Record<string, QueryValue>;
  /** Serialised as JSON, unless it is FormData. */
  body?: unknown;
  /** Merged over the defaults. */
  headers?: Record<string, string>;
  /**
   * The caller's cancellation signal — a component unmounting, a newer
   * auto-save superseding this one. Composed with the timeout below.
   */
  signal?: AbortSignal;
  /** Overrides DEFAULT_TIMEOUT_MS for this request. */
  timeoutMs?: number;
}

/**
 * Builds the query string.
 *
 * URLSearchParams rather than manual concatenation because it handles the
 * encoding B8 made matter: a search for "100%" must reach the server as
 * q=100%25. A hand-built string sends a bare % and the server either 400s or,
 * worse, searches for something the user did not type.
 *
 * Arrays become REPEATED parameters (?sort=a&sort=b). Spring binds both that
 * and comma-separated into a List, but repeated is unambiguous when a value
 * could itself contain a comma.
 */
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

/**
 * Joins the base URL and path.
 *
 * String concatenation, NOT `new URL(path, base)` — which throws TypeError
 * when the base is relative, and ours is: 1D's proxy decision makes
 * apiBaseUrl "/api/v1" in development so the browser talks same-origin.
 */
function buildUrl(path: string, query: Record<string, QueryValue> | undefined): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalised}${buildQuery(query)}`;
}

/**
 * Prepares the body and the headers that describe it.
 *
 * The FormData branch exists NOW rather than in Step 10 because without it,
 * JSON.stringify(formData) returns "{}" — an empty object uploaded with a
 * straight face, no error anywhere. And a multipart body must NOT carry a
 * Content-Type we set: the browser generates a boundary parameter, and a
 * hand-written "multipart/form-data" omits it, leaving the server unable to
 * parse a request that looks perfectly well formed.
 */
function prepareBody(body: unknown): { body: BodyInit | null; headers: Record<string, string> } {
  if (body === undefined) {
    /*
     * null, not undefined. RequestInit.body is typed `BodyInit | null` — the
     * DOM chose null for "no body", and under exactOptionalPropertyTypes (1B)
     * the two stop being interchangeable. Match the platform's spelling.
     *
     * No Content-Type either: sending one on a GET is meaningless and can trip
     * stricter proxies.
     */
    return { body: null, headers: {} };
  }

  if (body instanceof FormData) {
    return { body, headers: {} };
  }

  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  };
}

async function request<T>(method: string, path: string, config: RequestConfig = {}): Promise<T> {
  const prepared = prepareBody(config.body);

  /*
   * AbortSignal.timeout rather than setTimeout(() => controller.abort(), ms).
   *
   * The hand-rolled version needs a clearTimeout on EVERY exit path, including
   * the error paths. Miss one and a timer survives to fire later and abort
   * nothing — a leak that is invisible until a long-lived page accumulates
   * hundreds of them.
   */
  const timeoutSignal = AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  /*
   * Composed: aborts when EITHER the caller cancels or the deadline elapses.
   * The caller's signal is optional, so compose only what exists.
   */
  const signal = config.signal ? AbortSignal.any([config.signal, timeoutSignal]) : timeoutSignal;

  const headers: Record<string, string> = {
    // Spring content-negotiates on this. Asking for JSON is what gets us a
    // ProblemDetail rather than an HTML error page from the error handler.
    accept: 'application/json',
    ...prepared.headers,
    ...config.headers,

    /*
     * STEP 4 SEAM. The Authorization header goes here, along with the 401 ->
     * single-flight refresh -> retry-once interceptor.
     */
  };

  let response: Response;

  try {
    response = await fetch(buildUrl(path, config.query), {
      method,
      headers,
      body: prepared.body,
      signal,
    });
  } catch {
    /*
     * Three different failures arrive here and must be told apart, because
     * callers do genuinely different things with each.
     *
     * The inputs are inspected rather than the thrown error's name. Runtimes
     * differ in how faithfully they propagate an abort reason through fetch,
     * and asking "did the caller's signal fire?" is both deterministic and
     * makes the precedence below explicit rather than incidental.
     */

    // CALLER FIRST, deliberately. If both fired, the user's intent is the more
    // useful classification: `aborted` is swallowed silently, `timeout` is
    // surfaced and retried.
    if (config.signal?.aborted === true) {
      throw new ApiError({ kind: 'aborted' });
    }

    if (timeoutSignal.aborted) {
      /*
       * IMPORTANT: this stops US waiting. It does NOT stop the server.
       *
       * Spring has no idea we gave up and finishes the transaction, so a
       * timed-out POST /notes may well have created the note. That is why
       * 3A's isOffline() counts a timeout alongside a network failure — both
       * mean "we do not know" — and why /sync/batch carries an operationId.
       * Retrying a timed-out write is safe on the sync path and genuinely
       * ambiguous everywhere else.
       */
      throw new ApiError({ kind: 'timeout' });
    }

    /*
     * fetch rejects ONLY when the request never completed. A 500 resolves
     * normally (see 3B). The rejection is a TypeError with a deliberately
     * vague message: offline, DNS failure and CORS refusal are
     * indistinguishable to JavaScript, because the browser withholds the
     * reason so a page cannot probe networks it should not see.
     */
    throw new ApiError({ kind: 'network' });
  }

  return parseResponse<T>(response);
}

/**
 * Verb wrappers. They add nothing but a name — and a name is worth it:
 * `httpClient.patch(...)` says the semantics (partial update, leave omitted
 * fields alone) that `request('PATCH', ...)` buries in a string.
 */
export const httpClient = {
  get: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('GET', path, config),

  post: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('POST', path, config),

  put: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('PUT', path, config),

  patch: <T>(path: string, config?: RequestConfig): Promise<T> => request<T>('PATCH', path, config),

  /*
   * `delete` is a reserved word as an identifier but legal as a property name.
   * Named to match the HTTP verb rather than softened to `del`.
   */
  delete: <T>(path: string, config?: RequestConfig): Promise<T> =>
    request<T>('DELETE', path, config),
};
