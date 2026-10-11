import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { peopleRepository } from '@/features/notes/local/peopleRepository';
import type { PersonRow } from '@/features/notes/local/personRow';
import { userLookupService } from '@/features/userLookup/api/userLookupService';
import { formatUserName } from '@/features/userLookup/hooks/useUserLookup';

/** The most ids the server's lookup takes in one request. */
const LOOKUP_MAX = 100;

/**
 * Copies the People list from the server into Dexie. A person is Connected when
 * either side's invite was accepted, and Pending when you invited them and they
 * have not answered. Invites sent to you are not here: they are in the bell.
 * Throws when the server cannot be reached; callers keep what is cached.
 */
export async function refreshPeople(): Promise<void> {
  const [sent, received] = await Promise.all([
    collaborationService.listSent(),
    collaborationService.listReceived(),
  ]);

  const found = new Map<number, Pick<PersonRow, 'state' | 'collaborationId'>>();
  for (const row of received.content) {
    if (row.status === 'ACCEPTED') {
      found.set(row.ownerId, { state: 'connected', collaborationId: row.id });
    }
  }
  for (const row of sent.content) {
    if (row.status === 'ACCEPTED') {
      found.set(row.collaboratorId, { state: 'connected', collaborationId: row.id });
    } else if (row.status === 'PENDING' && !found.has(row.collaboratorId)) {
      found.set(row.collaboratorId, { state: 'pending', collaborationId: row.id });
    }
  }

  const ids = [...found.keys()].slice(0, LOOKUP_MAX);
  const profiles = ids.length > 0 ? await userLookupService.lookupUsers(ids) : [];

  const rows = profiles.flatMap((profile): PersonRow[] => {
    const entry = found.get(profile.id);
    if (!entry) return [];
    return [{ id: profile.id, name: formatUserName(profile), username: profile.username, ...entry }];
  });
  await peopleRepository.replaceAll(rows);
}
