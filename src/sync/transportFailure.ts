/**
 * Whether the run in progress hit a transport failure.
 *
 * `pushOutbox`/`pullChanges` return `Promise<void>` and swallow a transport
 * failure (`isOffline(error)`) rather than rejecting — correct for 8C/8D's
 * own job, "leave everything queued, state stays consistent, the next
 * trigger retries," and changing that return type now would ripple into
 * every existing caller (`conflicts.ts`'s direct `pushOutbox()` call among
 * them) for no benefit to those callers.
 *
 * But 8F's engine has a question those callers never needed answered: did
 * THIS run actually reach the server, or did it quietly do nothing? That is
 * exactly the bit `isOffline(error)` already detects and then discards.
 * `push.ts`/`pull.ts` set this flag in the same breath they swallow the
 * error; `engine.ts` reads and clears it around each attempt.
 */

let failed = false;

export function markTransportFailure(): void {
  failed = true;
}

/** Reads and clears in one step — two consecutive reads must not both see the same failure. */
export function consumeTransportFailure(): boolean {
  const value = failed;
  failed = false;
  return value;
}
