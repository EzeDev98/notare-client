import type { ReactNode } from 'react';

import { AuthContext } from '@/app/providers/auth-context';
import type { CurrentUser } from '@/features/auth/types';
import { db } from '@/features/notes/local/database';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

/**
 * A signed-in session, supplied directly rather than through AuthProvider.
 *
 * WHY THIS EXISTS. Before 7C the pages read from the network, so an
 * unauthenticated AuthProvider was harmless in tests — MSW answered the
 * request and the screen filled. Now every read is scoped by ownerId, so an
 * unauthenticated provider means the live query returns nothing and the page
 * renders an empty state forever. Most of the suite broke on exactly this.
 *
 * Providing the CONTEXT rather than the provider is deliberate: AuthProvider
 * owns token storage and refresh, none of which a notes-list test is about.
 * Driving it into an authenticated state would mean logging in through MSW in
 * every file — slow, and it couples every test to the auth flow, so an auth
 * regression would fail two hundred unrelated tests.
 */
export const TEST_USER: CurrentUser = {
  id: 1,
  notarianId: 'NTR-0001',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-08-01T09:00:00.000',
};

export function SignedIn({ children, user = TEST_USER }: { children: ReactNode; user?: CurrentUser }) {
  return (
    <AuthContext
      value={{
        state: { status: 'authenticated', user },
        login: () => Promise.resolve(),
        logout: () => Promise.resolve(),
        reauthenticate: () => Promise.resolve(),
      }}
    >
      {children}
    </AuthContext>
  );
}

/**
 * Puts rows in the local database, as though a previous session had synced
 * them.
 *
 * Tests seed Dexie rather than only stubbing the network, because the network
 * is no longer where the list comes from — stubbing GET /notes proves the
 * refresh works, not that the page renders.
 */
export async function seedNotes(...rows: NoteRow[]): Promise<void> {
  for (const row of rows) {
    await noteRepository.put(row);
  }
}

/**
 * Empties the local database between tests.
 *
 * fake-indexeddb persists for the lifetime of the module, not the test, so
 * without this a row seeded in one test is still there in the next — and a
 * test can pass by finding a note it never created.
 */
export async function resetDatabase(): Promise<void> {
  await db.notes.clear();
  await db.meta.clear();
  // 8A added this table after resetDatabase was written; a leaked outbox row
  // is the same class of false-green risk the comment on setup.ts's afterEach
  // already names for db.notes — a queued operation appearing in a test that
  // never queued one.
  await db.outbox.clear();
}
