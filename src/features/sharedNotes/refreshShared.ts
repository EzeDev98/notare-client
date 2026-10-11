import { gateway } from '@/core/adapter';
import type { SharedRow } from '@/features/notes/local/sharedRow';
import { sharedRepository } from '@/features/notes/local/sharedRepository';
import { userLookupService } from '@/features/userLookup/api/userLookupService';
import { formatUserName } from '@/features/userLookup/hooks/useUserLookup';

const PAGE_SIZE = 100;

/**
 * Copies "Shared with me" from the server into Dexie, so the list, search and
 * the drawer count read local data only (M-5). The text is the server's preview.
 * Throws when the server cannot be reached; callers keep what is cached.
 */
export async function refreshShared(): Promise<void> {
  const page = await gateway.listSharedNotes({ page: 0, size: PAGE_SIZE });

  const ownerIds = [...new Set(page.content.map((item) => item.ownerId))];
  const profiles = ownerIds.length > 0 ? await userLookupService.lookupUsers(ownerIds) : [];
  const names = new Map(profiles.map((profile) => [profile.id, formatUserName(profile)]));

  const rows: SharedRow[] = page.content.map((item) => ({
    noteId: item.note.id,
    role: item.permission === 'WRITE' ? 'editor' : 'viewer',
    ownerId: item.ownerId,
    ownerName: names.get(item.ownerId) ?? null,
    content: item.note.contentPreview ?? '',
    updatedAt: item.note.updatedAt,
  }));
  await sharedRepository.replaceAll(rows);
}
