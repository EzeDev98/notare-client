/** Whether the current sync run could not reach the server. */
let failed = false;

export function markTransportFailure(): void {
  failed = true;
}

export function consumeTransportFailure(): boolean {
  const value = failed;
  failed = false;
  return value;
}
