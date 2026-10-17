import { api } from '@/core/api';
import { createNoteWithContent, duplicateNote } from '@/features/notes/createNote';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { sharedNoteIdOf } from '@/features/notes/list/listItem';
import { flag } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { sharedRepository } from '@/features/notes/local/sharedRepository';
import { isOffline } from '@/lib/http/errors';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * What the list menu does to a note. Every action is local first: the row is
 * written, the screen follows from Dexie, and the server is told afterwards.
 * A failed request needs no rollback; the row stays dirty and correct (7D).
 */
type Ack = { version: number | null; updatedAt: ServerDateTime | null } | undefined;

/**
 * Tells the server what the local write already did. Returns false when the
 * note has never reached the server, so there was nobody to tell.
 */
async function tellServer(
  localId: string,
  send: (serverId: number) => Promise<Ack>,
  onFail?: (error: unknown, serverId: number) => Promise<void>,
): Promise<boolean> {
  const written = await noteRepository.getByLocalId(localId);
  if (!written || written.serverId === null) return false;

  try {
    const ack = await send(written.serverId);
    await noteRepository.applyServerAck(
      localId,
      ack ?? { version: written.version, updatedAt: written.updatedAt },
      written.localUpdatedAt,
    );
  } catch (error) {
    await onFail?.(error, written.serverId);
  }
  return true;
}

export async function setPinned(localId: string, pinned: boolean): Promise<void> {
  await noteRepository.applyLocalEdit(localId, { pinned: flag(pinned) });
  await tellServer(localId, (serverId) => api.setPinned(serverId, pinned));
}

export async function setArchived(localId: string, archived: boolean): Promise<void> {
  await noteRepository.applyLocalEdit(localId, { archived: flag(archived) });
  await tellServer(localId, (serverId) => api.setArchived(serverId, archived));
}

/** Delete: the note moves to Recently deleted. A delete made offline is queued (8B). */
export async function moveToTrash(localId: string): Promise<void> {
  await noteRepository.setDeleted(localId, true);

  const sent = await tellServer(
    localId,
    async (serverId) => {
      await api.deleteNote(serverId);
      return undefined;
    },
    async (error, serverId) => {
      if (isOffline(error)) await outboxRepository.enqueueDelete({ localId, noteId: serverId });
    },
  );
  // Never created on the server: drop a queued create, there is nothing left to create.
  if (!sent) await outboxRepository.discardPendingCreate(localId);
}

/** Restore also cancels a queued delete, or a later push would trash the note again. */
export async function restoreNote(localId: string): Promise<void> {
  await noteRepository.setDeleted(localId, false);
  await outboxRepository.cancelPendingDelete(localId);
  await tellServer(localId, (serverId) => api.restoreNote(serverId));
}

/** The copy says so on its first line: "Trip budget" becomes "Trip budget copy". */
function copyText(content: string): string {
  const lines = content.split('\n');
  const at = lines.findIndex((line) => line.trim() !== '');
  if (at < 0) return `${LIST_COPY.untitled}${LIST_COPY.copySuffix}`;
  return lines.map((line, i) => (i === at ? `${line.trimEnd()}${LIST_COPY.copySuffix}` : line)).join('\n');
}

/**
 * Make a copy: a new note of your own. A note from your own list also copies
 * its voice clips that are still on this device. False if there was nothing to copy.
 */
export async function copyNote(ownerId: number, itemId: string): Promise<boolean> {
  const sharedId = sharedNoteIdOf(itemId);
  if (sharedId !== null) {
    const shared = await sharedRepository.get(sharedId);
    if (!shared) return false;
    return (await createNoteWithContent(ownerId, copyText(shared.content))) !== null;
  }

  const source = await noteRepository.getByLocalId(itemId);
  if (!source) return false;
  return (await duplicateNote(ownerId, itemId, copyText(source.content))) !== null;
}

/**
 * Leave a note shared with you: the server removes your access first, then it goes from this
 * device. If the server says no, nothing changes here. Takes a Shared with me row id or the id of
 * a note row you do not own. The menu item stays hidden until step 17f builds the endpoint
 * (FEATURES.leaveNote).
 */
export async function leaveNote(itemId: string): Promise<void> {
  const sharedId = sharedNoteIdOf(itemId);
  if (sharedId !== null) {
    await api.leaveNote(sharedId);
    await sharedRepository.remove(sharedId);
    return;
  }
  const row = await noteRepository.getByLocalId(itemId);
  if (!row || row.serverId === null) return;
  await api.leaveNote(row.serverId);
  await noteRepository.hardDelete(itemId);
}

/**
 * The owner removed you: forget the note on this device, with no server call. Never touches a note
 * you own.
 */
export async function dropSharedNote(itemId: string): Promise<void> {
  const sharedId = sharedNoteIdOf(itemId);
  if (sharedId !== null) {
    await sharedRepository.remove(sharedId);
    return;
  }
  const row = await noteRepository.getByLocalId(itemId);
  if (row && row.role !== 'owner') await noteRepository.hardDelete(itemId);
}
