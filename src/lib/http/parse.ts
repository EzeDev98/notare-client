/** Turns a response into a value or an ApiError. */
import { ApiError, type ApiErrorDetail } from '@/lib/http/errors';

function mediaType(response: Response): string {
  const header = response.headers.get('content-type') ?? '';
  return (header.split(';')[0] ?? '').trim().toLowerCase();
}

function isJsonType(type: string): boolean {
  return type === 'application/json' || type === 'application/problem+json';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readBodyText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    throw new ApiError({ kind: 'network' });
  }
}

function parseJson(raw: string, status: number): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError({ kind: 'parse', status });
  }
}

function toErrorDetail(status: number, type: string, body: unknown): ApiErrorDetail {
  if (type === 'application/problem+json' && isObject(body)) {
    const {
      type: _type,
      title,
      status: _status,
      detail,
      instance: _instance,
      ...extensions
    } = body;

    return {
      kind: 'problem',
      status,
      title: typeof title === 'string' ? title : 'Error',
      detail: typeof detail === 'string' ? detail : 'The request could not be completed.',
      extensions,
    };
  }

  return { kind: 'http', status, body };
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const type = mediaType(response);
  const raw = await readBodyText(response);

  const body: unknown =
    raw === '' ? undefined : isJsonType(type) ? parseJson(raw, response.status) : raw;

  if (!response.ok) {
    throw new ApiError(toErrorDetail(response.status, type, body));
  }

  return body as T;
}
