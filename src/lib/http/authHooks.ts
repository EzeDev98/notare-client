/** Lets auth plug into the HTTP client. */
export interface AuthHooks {
  getAuthorization: () => Promise<string | null>;

  recoverFromUnauthorized: (usedAuthorization: string | null) => Promise<boolean>;
}

let hooks: AuthHooks | null = null;

export function setAuthHooks(next: AuthHooks | null): void {
  hooks = next;
}

export function getAuthHooks(): AuthHooks | null {
  return hooks;
}
