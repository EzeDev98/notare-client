/** The HTTP client. */
import { getAuthHooks } from '@/lib/http/authHooks';
import { env } from '@/lib/config/env';
import { ApiError, UPDATE_REQUIRED_STATUS } from '@/lib/http/errors';
import { parseResponse } from '@/lib/http/parse';
import { signalUpdateRequired } from '@/lib/http/updateRequired';
import { HTTP_TIMEOUT_MS } from '@/core/config/timings';

type QueryValue = string | number | boolean | undefined | (string | number)[];

export interface RequestConfig {
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
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

function buildUrl(path: string, query: Record<string, QueryValue> | undefined): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}${normalised}${buildQuery(query)}`;
}

function prepareBody(body: unknown): { body: BodyInit | null; headers: Record<string, string> } {
  if (body === undefined) {
    return { body: null, headers: {} };
  }

  if (body instanceof FormData) {
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

  async function attempt(): Promise<{ response: Response; authorization: string | null }> {
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
      if (config.signal?.aborted === true) throw new ApiError({ kind: 'aborted' });
      if (timeoutSignal.aborted) throw new ApiError({ kind: 'timeout' });

      throw new ApiError({ kind: 'network' });
    }
  }

  const first = await attempt();
  let response = first.response;
  const authorization = first.authorization;

  if (response.status === 401 && hooks) {
    if (await hooks.recoverFromUnauthorized(authorization)) {
      ({ response } = await attempt());
    }
  }

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
