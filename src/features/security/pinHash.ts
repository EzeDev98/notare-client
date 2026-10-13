/**
 * The PIN is never stored. What is stored is a salted PBKDF2 hash, made with
 * the browser's own crypto (crypto.subtle).
 *
 * This is a screen lock for the app, not encryption of the notes on disk
 * (decisions.md, D-030): four digits can be tried quickly by anyone who can
 * run code on the device, so the hash only keeps the digits themselves out of
 * storage. Do not describe it to people as encryption (O-15).
 */

/** How many times PBKDF2 repeats. Stored with each hash, so it can be raised later. */
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export interface PinRecord {
  /** Base64. Random for every PIN that is saved. */
  salt: string;
  /** Base64 of the derived bits. */
  hash: string;
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function derive(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

/** Hash a PIN with a new random salt. */
export async function hashPin(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(pin, salt, ITERATIONS);
  return { salt: toBase64(salt), hash: toBase64(bits), iterations: ITERATIONS };
}

/** True when the PIN produces the stored hash. Compares every byte, so the time does not leak where it differs. */
export async function matchesPin(pin: string, record: PinRecord): Promise<boolean> {
  const expected = fromBase64(record.hash);
  const actual = await derive(pin, fromBase64(record.salt), record.iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return difference === 0;
}
