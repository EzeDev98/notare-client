/** The API error type and helpers for it. */
export type ApiErrorDetail =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | {
      kind: 'problem';
      status: number;
      title: string;
      detail: string;
      extensions: Record<string, unknown>;
    }
  | { kind: 'http'; status: number; body: unknown }
  | { kind: 'parse'; status: number };

export class ApiError extends Error {
  readonly detail: ApiErrorDetail;

  constructor(detail: ApiErrorDetail) {
    super(describe(detail));
    this.name = 'ApiError';
    this.detail = detail;
  }
}

function describe(detail: ApiErrorDetail): string {
  switch (detail.kind) {
    case 'network':
      return 'Network request failed';
    case 'timeout':
      return 'Request timed out';
    case 'aborted':
      return 'Request was cancelled';
    case 'problem':
      return `HTTP ${String(detail.status)}: ${detail.title}`;
    case 'http':
      return `HTTP ${String(detail.status)}`;
    case 'parse':
      return `Malformed response body (HTTP ${String(detail.status)})`;
    default: {
      const exhaustive: never = detail;
      return String(exhaustive);
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function statusOf(error: unknown): number | undefined {
  if (!isApiError(error)) return undefined;
  const { detail } = error;
  return detail.kind === 'problem' || detail.kind === 'http' || detail.kind === 'parse'
    ? detail.status
    : undefined;
}

export function isUnauthorized(error: unknown): boolean {
  return statusOf(error) === 401;
}

export function isForbidden(error: unknown): boolean {
  return statusOf(error) === 403;
}

export function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

export function isBadRequest(error: unknown): boolean {
  return statusOf(error) === 400;
}

export function fieldErrors(error: unknown): Record<string, string> | undefined {
  if (!isApiError(error) || error.detail.kind !== 'problem') return undefined;

  const raw = error.detail.extensions['errors'];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;

  const result: Record<string, string> = {};
  for (const [field, message] of Object.entries(raw)) {
    if (typeof message === 'string') result[field] = message;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function isOffline(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.detail.kind === 'network' || error.detail.kind === 'timeout';
}

export function isAborted(error: unknown): boolean {
  return isApiError(error) && error.detail.kind === 'aborted';
}

export function isRetriable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const { detail } = error;
  if (detail.kind === 'network' || detail.kind === 'timeout') return true;
  if (detail.kind === 'problem' || detail.kind === 'http') return detail.status >= 500;
  return false;
}

export const UPDATE_REQUIRED_STATUS = 426;

export function isUpdateRequired(error: unknown): boolean {
  return statusOf(error) === UPDATE_REQUIRED_STATUS;
}
