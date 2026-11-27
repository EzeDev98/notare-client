/** Pin, delete, copy and restore-original for a note. */
import { api } from '@/core/api';
import { duplicateNote } from '@/features/notes/createNote';
import { LIST_COPY } from '@/features/notes/list/listContent';
import { flag } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isNotFound, isOffline } from '@/lib/http/errors';
import type { ServerDateTime } from '@/lib/http/types';

type Ack = { version: number | null; updatedAt: ServerDateTime | null } | undefined;

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

export async function deleteNote(localId: string): Promise<boolean> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row) return true;

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

function copyText(content: string): string {
  const lines = content.split('\n');
  const at = lines.findIndex((line) => line.trim() !== '');
  if (at < 0) return `${LIST_COPY.untitled}${LIST_COPY.copySuffix}`;
  return lines.map((line, i) => (i === at ? `${line.trimEnd()}${LIST_COPY.copySuffix}` : line)).join('\n');
}

export async function copyNote(ownerId: number, itemId: string): Promise<boolean> {
  const source = await noteRepository.getByLocalId(itemId);
  if (!source) return false;
  return (await duplicateNote(ownerId, itemId, copyText(source.content))) !== null;
}

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
