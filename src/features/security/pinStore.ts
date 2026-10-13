import { PIN_LENGTH, PIN_MAX_TRIES } from '@/core/config/timings';
import { META_KEYS } from '@/features/notes/local/metaRow';
import { metaRepository } from '@/features/notes/local/metaRepository';

import { hashPin, matchesPin, type PinRecord } from './pinHash';

/** The result of trying a PIN. `left` is how many tries remain; 0 means locked out. */
export type PinCheck = { ok: true } | { ok: false; left: number };

/** True for exactly four digits (or whatever PIN_LENGTH says). */
export function isValidPin(pin: string): boolean {
  return pin.length === PIN_LENGTH && /^\d+$/.test(pin);
}

async function readRecord(): Promise<PinRecord | null> {
  return (await metaRepository.get<PinRecord | null>(META_KEYS.pinLock)) ?? null;
}

async function readFailures(): Promise<number> {
  return (await metaRepository.get<number>(META_KEYS.pinFailures)) ?? 0;
}

/** Is the PIN lock on? Also what a live query watches. */
export async function isPinSet(): Promise<boolean> {
  return (await readRecord()) !== null;
}

/** Turn the lock on, or change the PIN. Only the salted hash is written. */
export async function savePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('A PIN is four digits.');
  const record = await hashPin(pin);
  await metaRepository.set(META_KEYS.pinFailures, 0);
  await metaRepository.set(META_KEYS.pinLock, record);
}

/** Turn the lock off. Also forgets the wrong-PIN count. */
export async function clearPin(): Promise<void> {
  await metaRepository.remove(META_KEYS.pinLock);
  await metaRepository.remove(META_KEYS.pinFailures);
}

/** Tries left before the lock asks the person to sign in again. */
export async function triesLeft(): Promise<number> {
  return Math.max(0, PIN_MAX_TRIES - (await readFailures()));
}

/**
 * Try a PIN. The wrong-PIN count is kept on the device, so closing the app does
 * not give back the tries. After the last one even the right PIN is refused:
 * the way out is to sign in again, which clears the lock.
 */
export async function checkPin(pin: string): Promise<PinCheck> {
  const record = await readRecord();
  if (!record) return { ok: true };

  const failures = await readFailures();
  if (failures >= PIN_MAX_TRIES) return { ok: false, left: 0 };

  if (await matchesPin(pin, record)) {
    if (failures > 0) await metaRepository.set(META_KEYS.pinFailures, 0);
    return { ok: true };
  }

  const next = failures + 1;
  await metaRepository.set(META_KEYS.pinFailures, next);
  return { ok: false, left: Math.max(0, PIN_MAX_TRIES - next) };
}
