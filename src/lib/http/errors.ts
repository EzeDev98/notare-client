/**
 * The typed error model. Everything above this layer branches on ApiError
 * rather than inspecting raw responses.
 *
 * The failure this replaces (§11):
 *
 *   catch (error) { console.log(error); }
 *
 * That is not laziness. `catch` gives you `unknown`, and there is nothing
 * useful to do with `unknown` — so it gets logged and the UI shows "Something
 * went wrong" for a expired session, a concurrent edit, and being offline
 * alike. Three situations, three correct responses, one useless string.
 */

/**
 * The discriminated union. Six variants, each existing because something
 * downstream must treat it differently — not because six felt tidy.
 */
export type ApiErrorDetail =
  /**
   * fetch() itself rejected: offline, DNS failure, CORS refusal, connection
   * reset. NOT an error status — a 500 resolves normally (see 3C).
   *
   * Indistinguishable from a CORS rejection by design: the browser refuses to
   * tell JavaScript why, so "no network" and "server rejected the origin" look
   * identical. Worth remembering when a request fails only in production.
   */
  | { kind: 'network' }

  /** Our own deadline elapsed (3D). The server may still be working. */
  | { kind: 'timeout' }

  /**
   * WE cancelled it — component unmounted, a newer request superseded this
   * one. Expected, not a failure. In the union precisely so callers can
   * recognise and IGNORE it; Step 6's auto-save cancels superseded saves
   * constantly, and surfacing those as errors would be the bug.
   */
  | { kind: 'aborted' }

  /**
   * RFC 9457 ProblemDetail. What the server sends for every exception its
   * GlobalExceptionHandler declares, plus (since B2) the framework's own.
   *
   * `extensions` holds root-level members beyond the standard five: the
   * `errors` map from validation failures, `currentVersion` on a note
   * conflict. Typed `unknown` because the server can add members we have never
   * heard of, and pretending otherwise is how a malformed response becomes a
   * crash three components away.
   */
  | {
      kind: 'problem';
      status: number;
      title: string;
      detail: string;
      extensions: Record<string, unknown>;
    }

  /**
   * An error status whose body is NOT ProblemDetail.
   *
   * Separate from `problem` because B2 did not unify everything: handled
   * exceptions produce ProblemDetail, but a genuinely unhandled 500 still
   * falls through to Boot's default {timestamp, status, error, path}. This
   * variant is what the server actually sends, not what we wish it sent.
   */
  | { kind: 'http'; status: number; body: unknown }

  /**
   * The body was not what the status implied — a 200 that is not valid JSON,
   * a ProblemDetail missing required fields. Always OUR bug or a contract
   * change, never the user's. Never retried, always reported.
   */
  | { kind: 'parse'; status: number };

/**
 * Errors are thrown as an Error SUBCLASS, not as a plain object.
 *
 * Throwing `{ kind: 'network' }` works and loses the stack trace, which is
 * most of what makes a production error report useful. This carries the union
 * as a field, so you get a real stack AND full narrowing.
 *
 * Note the explicit field declaration and assignment. The reflex is
 * `constructor(readonly detail: ApiErrorDetail)` — a parameter property, which
 * is TypeScript syntax that EMITS an assignment, and 1B's erasableSyntaxOnly
 * rejects it. Three lines instead of one, and nothing in the output that was
 * not written.
 */
export class ApiError extends Error {
  readonly detail: ApiErrorDetail;

  constructor(detail: ApiErrorDetail) {
    super(describe(detail));
    // Without this the name is "Error" and every log line looks the same.
    this.name = 'ApiError';
    this.detail = detail;
  }
}

/**
 * A short technical description, for logs and stack traces.
 *
 * NOT for users. It says "HTTP 500" where a user needs "we could not save your
 * note, it is safe on this device". User-facing wording is the UI's job,
 * because only the UI knows what the user was trying to do.
 *
 * The `default` branch assigns to `never`: add a variant to ApiErrorDetail and
 * forget it here, and this stops compiling. The closest TypeScript gets to an
 * exhaustive switch over a sealed type — and it erases entirely, so it costs
 * nothing at runtime.
 */
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

/**
 * The bridge from `unknown` back to something usable.
 *
 * Required because JavaScript can throw ANYTHING — a string, a number,
 * undefined. `strict` reflects that by typing catch variables as `unknown`,
 * which is unfamiliar next to Java's `catch (IOException e)` but is simply
 * honest about the language.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/* ---------------------------------------------------------------------------
 * Narrowing helpers.
 *
 * Nothing above this layer should write `error.status === 409`. A named helper
 * says what the check MEANS, and gives one place to change when the contract
 * does. These take `unknown` so a caller can pass a raw catch variable
 * straight in.
 * ------------------------------------------------------------------------ */

/** The status, for any variant that has one. */
export function statusOf(error: unknown): number | undefined {
  if (!isApiError(error)) return undefined;
  const { detail } = error;
  return detail.kind === 'problem' || detail.kind === 'http' || detail.kind === 'parse'
    ? detail.status
    : undefined;
}

/**
 * 401 — credentials missing or stale. TRIGGERS THE REFRESH in Step 4.
 *
 * This is only a usable signal because of B2: before it, an expired token
 * produced an empty 403 indistinguishable from a real permission denial, and
 * no refresh loop could be built on that.
 */
export function isUnauthorized(error: unknown): boolean {
  return statusOf(error) === 401;
}

/**
 * 403 — authenticated and still not allowed. Do NOT retry, do NOT refresh.
 *
 * The server uses this only where the resource is already known to be
 * accessible but the action is forbidden: a READ collaborator attempting a
 * write. Everything else answers 404 rather than confirming a resource exists.
 */
export function isForbidden(error: unknown): boolean {
  return statusOf(error) === 403;
}

/**
 * 404 — and on this server that means "no such note, OR not yours". The
 * ambiguity is deliberate, so the UI must not phrase it as "this note was
 * deleted" when it may equally be someone else's.
 */
export function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

/** 409 — optimistic lock failure. Drives the conflict UI in Step 6. */
export function isConflict(error: unknown): boolean {
  return statusOf(error) === 409;
}

/**
 * The server's current version from a conflict, when it sent one.
 *
 * `number | undefined` and not `number`, because 409 arrives in TWO flavours:
 * NoteConflictException carries a root-level currentVersion, while
 * ObjectOptimisticLockingFailureException carries nothing at all. A client
 * assuming the field is always present crashes on the rarer path — which is
 * exactly the path that only shows up under real concurrency.
 *
 * Undefined means "refetch the note to find out".
 */
export function conflictVersion(error: unknown): number | undefined {
  if (!isApiError(error) || error.detail.kind !== 'problem') return undefined;
  const value = error.detail.extensions['currentVersion'];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Per-field validation messages from B2's `errors` extension member, keyed by
 * field name so a form can attach each to its input.
 *
 * Every value is checked rather than the object being cast. `extensions` is
 * `unknown` for a reason: casting to Record<string, string> and hoping is how
 * a contract change becomes a crash in a component that never touched the
 * network. Non-string values are dropped rather than rendered as "[object
 * Object]" under an input.
 */
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

/**
 * True when the request never reached the server.
 *
 * The signal for "queue this for the outbox rather than surfacing a failure"
 * in Step 8. A timeout counts: we do not know whether the server got it, and
 * the sync protocol's operationId makes replaying safe either way.
 */
export function isOffline(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.detail.kind === 'network' || error.detail.kind === 'timeout';
}

/**
 * True when WE cancelled the request. Callers should swallow these silently.
 *
 * Its own helper because "ignore this" is a decision worth naming — a bare
 * `if (err.detail.kind === 'aborted') return;` in a component reads like
 * someone forgot to handle a case.
 */
export function isAborted(error: unknown): boolean {
  return isApiError(error) && error.detail.kind === 'aborted';
}

/**
 * True when retrying MIGHT help.
 *
 * 5xx and transport failures are transient; 4xx means the request itself is
 * wrong and will be wrong again. Retrying a 400 forever is a classic
 * client-side loop, and it is a loop the server cannot defend against.
 */
export function isRetriable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  const { detail } = error;
  if (detail.kind === 'network' || detail.kind === 'timeout') return true;
  if (detail.kind === 'problem' || detail.kind === 'http') return detail.status >= 500;
  return false;
}
