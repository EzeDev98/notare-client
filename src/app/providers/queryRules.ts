import { isRetriable } from '@/lib/http/errors';

/** How many times a transient failure is tried again (master 9.5). */
export const QUERY_RETRY_MAX = 2;

/**
 * TanStack Query's `retry` option: try again only after a transient failure
 * (no connection, timeout, 5xx), and at most QUERY_RETRY_MAX times. A 4xx never
 * retries, because asking again gets the same answer.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < QUERY_RETRY_MAX && isRetriable(error);
}
