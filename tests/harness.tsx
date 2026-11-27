/** Test harness: a signed-in session and a seeded local database. */
import type { ReactNode } from 'react';

import { AuthContext } from '@/app/providers/auth-context';
import type { CurrentUser } from '@/features/auth/types';
import { db } from '@/features/notes/local/database';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

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

export async function seedNotes(...rows: NoteRow[]): Promise<void> {
  for (const row of rows) {
    await noteRepository.put(row);
  }
}

export async function resetDatabase(): Promise<void> {
  await db.notes.clear();
  await db.meta.clear();
  await db.outbox.clear();
}
