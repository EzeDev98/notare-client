import { gateway } from '@/core/adapter';
import type { SharedRow } from '@/features/notes/local/sharedRow';
import { sharedRepository } from '@/features/notes/local/sharedRepository';

const PAGE_SIZE = 100;

/**
 * Copies "Shared with me" from the server into the local shared table. The
 * server already sends the owner's name and the recipient's role, so there is
 * nothing to look up. A shared note's body is fetched when it is opened.
 */
export async function refreshShared(): Promise<void> {
  const page = await gateway.listSharedNotes({ page: 0, size: PAGE_SIZE });
  const rows: SharedRow[] = page.content.map((item) => ({
    noteId: item.noteId,
    role: item.role === 'EDITOR' ? 'editor' : 'viewer',
    ownerName: item.ownerName,
    content: item.contentPreview ?? item.title ?? '',
    updatedAt: item.updatedAt,
  }));
  await sharedRepository.replaceAll(rows);
}
