import { ApiError, type ApiErrorDetail } from '@/lib/http/errors';

/**
 * Turns a Response into a value, or throws an ApiError.
 *
 * The whole reason this file exists is that the server sends FOUR body shapes,
 * and `await response.json()` handles one of them:
 *
 *   application/problem+json   every handled exception, plus (since B2) the
 *                              framework's own — bad JSON, missing param,
 *                              unknown path, validation failure
 *   application/json           successful payloads, AND Boot's default
 *                              {timestamp, status, error, path} for genuinely
 *                              unhandled 500s
 *   empty                      204 from DELETE /notes/{id}/permanent
 *   anything else              a reverse proxy's HTML error page, a gateway
 *                              timeout — never from Spring, always possible
 */

/**
 * The media type without its parameters.
 *
 * The header is `application/problem+json;charset=UTF-8`, so a naive
 * `header === 'application/problem+json'` is false and the ProblemDetail
 * branch never runs — quietly, with every server error falling through to the
 * generic path.
 *
 * The `?? ''` after [0] is noUncheckedIndexedAccess (1B): split() always
 * returns at least one element, but the compiler cannot know that from the
 * type. One character of noise for a rule that is right far more often than
 * it is wrong.
 */
function mediaType(response: Response): string {
  const header = response.headers.get('content-type') ?? '';
  return (header.split(';')[0] ?? '').trim().toLowerCase();
}

function isJsonType(type: string): boolean {
  return type === 'application/json' || type === 'application/problem+json';
}

function isObject(value: unknown): value is Record<string, unknown> {
  // Arrays and null are both typeof 'object'. Neither is a ProblemDetail.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the body exactly once.
 *
 * A Response body is a STREAM. Calling .text() and then .json() throws "body
 * stream already read" — so everything downstream works from this one string
 * rather than re-reading the response.
 *
 * A failure here means the connection dropped mid-body: the request did not
 * complete, which is `network`, not `parse`. That distinction matters because
 * 3A's isRetriable() says yes to one and no to the other.
 */
async function readBodyText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    throw new ApiError({ kind: 'network' });
  }
}

/**
 * Parses JSON, or reports a malformed body.
 *
 * `parse` is always OUR bug or a contract change — a 200 that is not valid
 * JSON, a proxy returning HTML with a JSON content type. Never the user's, so
 * never retried and always reported.
 */
function parseJson(raw: string, status: number): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError({ kind: 'parse', status });
  }
}

/**
 * Builds the error variant for a non-ok response.
 *
 * Lenient about a ProblemDetail's SHAPE, strict about its ORIGIN: if the media
 * type says problem+json and the body is an object, it is treated as a problem
 * with fallbacks for anything missing. A strict guard that rejected a
 * slightly-off ProblemDetail would discard the `detail` string — the one part
 * actually written for a human to read.
 */
function toErrorDetail(status: number, type: string, body: unknown): ApiErrorDetail {
  if (type === 'application/problem+json' && isObject(body)) {
    /*
     * RFC 9457 defines five members; anything else is an extension. Rest
     * destructuring collects them in one line — which is why currentVersion
     * and the validation `errors` map need no special handling here. They are
     * ordinary extensions, and 3A already knows how to read them.
     *
     * The five discards are named with _ so noUnusedLocals (1B) accepts them;
     * ESLint's argsIgnorePattern covers the same convention.
     */
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

  /*
   * An error status whose body is not ProblemDetail. Reached by Boot's default
   * {timestamp, status, error, path} on an unhandled 500, by a proxy's HTML
   * error page, and by any empty error body.
   *
   * The raw body is kept for logging. It must NEVER be shown to a user: it may
   * contain a stack trace or an internal path.
   */
  return { kind: 'http', status, body };
}

/**
 * Reads a response, returning its parsed body or throwing an ApiError.
 *
 * THE CAST ON THE SUCCESS PATH IS THE ONE PLACE THIS LAYER KNOWINGLY LIES.
 * JSON.parse returns `unknown`, and something must assert it is a
 * NoteResponse. The alternatives were runtime schemas (zod) or hand-written
 * guards per payload; both mean maintaining a second copy of every backend DTO
 * and both drift, producing exactly the bug validation was supposed to catch.
 * The server is ours and its contract is documented, so we trust it — but the
 * trust is confined to this line rather than spread across every caller.
 *
 * Worth revisiting at STEP 8, and only there: a malformed sync payload does
 * not merely render wrong, it gets written into IndexedDB and corrupts local
 * state that outlives the request. Different risk, possibly different answer.
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  const type = mediaType(response);
  const raw = await readBodyText(response);

  /*
   * An empty body is legitimate: 204 from a permanent delete, and some error
   * responses. `await response.json()` throws an unhelpful SyntaxError on it,
   * which is how "delete succeeded" ends up reported as a parse failure.
   */
  const body: unknown =
    raw === '' ? undefined : isJsonType(type) ? parseJson(raw, response.status) : raw;

  /*
   * fetch does NOT reject on 4xx or 5xx — a 500 resolves exactly like a 200.
   * The promise only rejects when the request never completed. This check is
   * the entire difference between handling an error and treating an error body
   * as data, and it is the biggest adjustment coming from RestTemplate, which
   * throws on error statuses.
   */
  if (!response.ok) {
    throw new ApiError(toErrorDetail(response.status, type, body));
  }

  return body as T;
}
