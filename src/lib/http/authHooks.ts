/**
 * The seam between HTTP and authentication.
 *
 * lib/ must never import features/ (1C). But the Authorization header is
 * auth's concern and httpClient is infrastructure — so infrastructure declares
 * the INTERFACE it needs and the auth feature registers an implementation. The
 * dependency points feature -> lib, which is the direction the rule allows,
 * and lib/http stays usable by a project that has never heard of a session.
 */
export interface AuthHooks {
  /**
   * The Authorization header value for an outgoing request, or null when
   * there is no session.
   *
   * May refresh first — the implementation decides. Awaited before every
   * authenticated request, which is also what makes concurrent requests queue
   * behind a single refresh without any queue existing.
   */
  getAuthorization: () => Promise<string | null>;

  /**
   * Called once after a 401. Returns true if a retry is worth attempting.
   *
   * Receives the header value that was REJECTED, so the implementation can
   * tell "my token was stale" from "someone already replaced it while this
   * request was in flight".
   */
  recoverFromUnauthorized: (usedAuthorization: string | null) => Promise<boolean>;
}

let hooks: AuthHooks | null = null;

export function setAuthHooks(next: AuthHooks | null): void {
  hooks = next;
}

export function getAuthHooks(): AuthHooks | null {
  return hooks;
}
