import { api } from '@/core/api';
import { duplicateNote } from '@/features/notes/createNote';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { flag } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isNotFound, isOffline } from '@/lib/http/errors';
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

/**
 * Deletes a note for good. The row is hidden at once; a delete made offline is
 * queued and the row is removed when the server takes it (8B). False when the
 * server refused, and the note is back in the list.
 */
export async function deleteNote(localId: string): Promise<boolean> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row) return true;

  // Never created on the server: nothing to tell it, drop any queued create.
  if (row.serverId === null) {
    await outboxRepository.discardPendingCreate(localId);
    await noteRepository.hardDelete(localId);
    return true;
  }

  await noteRepository.setDeleted(localId, true);
  try {
    await api.deleteNote(row.serverId);
  } catch (error) {
    if (isOffline(error)) {
      await outboxRepository.enqueueDelete({ localId, noteId: row.serverId });
      return true;
    }
    if (!isNotFound(error)) {
      await noteRepository.setDeleted(localId, false);
      return false;
    }
  }
  await outboxRepository.clearForNote(localId);
  await noteRepository.hardDelete(localId);
  return true;
}

/** The copy says so on its first line: "Trip budget" becomes "Trip budget copy". */
function copyText(content: string): string {
  const lines = content.split('\n');
  const at = lines.findIndex((line) => line.trim() !== '');
  if (at < 0) return `${LIST_COPY.untitled}${LIST_COPY.copySuffix}`;
  return lines.map((line, i) => (i === at ? `${line.trimEnd()}${LIST_COPY.copySuffix}` : line)).join('\n');
}

/**
 * Make a copy: a new note of your own, with its voice clips that are still on
 * this device. False if there was nothing to copy.
 */
export async function copyNote(ownerId: number, itemId: string): Promise<boolean> {
  const source = await noteRepository.getByLocalId(itemId);
  if (!source) return false;
  return (await duplicateNote(ownerId, itemId, copyText(source.content))) !== null;
}

/**
 * "Restore original": asks the server for the text from before AI tidy and
 * applies the note it returns. False when it could not (offline, or the note
 * changed since), and nothing local is touched.
 */
export async function restoreOriginal(localId: string): Promise<boolean> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row || row.serverId === null || row.dirty === 1 || row.restorable !== true) return false;

  try {
    const note = await api.restoreOriginal(row.serverId);
    return (await noteRepository.upsertFromServer(note)) !== 'skipped';
  } catch {
    return false;
  }
}
