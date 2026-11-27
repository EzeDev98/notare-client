/** When a failed query is retried. */
import { isRetriable } from '@/lib/http/errors';

export const QUERY_RETRY_MAX = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < QUERY_RETRY_MAX && isRetriable(error);
}
