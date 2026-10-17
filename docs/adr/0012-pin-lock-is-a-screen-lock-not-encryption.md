# ADR-0012: The PIN is a screen lock, not encryption

**Status:** accepted (step 20c; first recorded as D-030)

## Decision

The PIN keeps a person out of the app on a device someone else is holding. It does not encrypt the notes.
Anyone with the device unlocked and DevTools can read IndexedDB, and four digits can be tried quickly by code on
the device. The app never describes the PIN as encryption.

- **Storage.** Only a salted PBKDF2 hash is stored (SHA-256, random 16-byte salt, 100,000 rounds, in `meta`).
  The digits are never stored. The round count is kept with each hash so it can be raised later.
- **Device, not account (O-15).** The PIN belongs to the device so the app opens offline.
- **Attempts.** The wrong-PIN count is kept in `meta`, so closing the app does not give the tries back. Five
  wrong PINs refuse even the right one until the person signs in again, which turns the lock off.
- **When it shows.** When the app opens, and when the person returns from the background after
  `PIN_LOCK_DELAY_MS`. Normal sign-out and a failed start-up leave the PIN in place.

## Context

A real encryption design would need a key the person types on every open and would make forgotten PINs
unrecoverable. The product chose an offline-friendly lock with a clear limit instead.

## Consequences

- "Forgot PIN? Sign in again" removes the lock and keeps the notes.
- The copy must not promise protection against someone with technical access to the device.
