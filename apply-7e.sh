# ============================================================================
# NOTARE CLIENT — 7E : Trash and archived on the repository
# Run from the repo root (notare-client/). Overwrites in place.
# ============================================================================

mkdir -p src/features/notes/local src/features/notes/hooks src/pages/Trash

# ---------------------------------------------------------------------------
# 1. src/features/notes/local/noteMappers.ts
# ---------------------------------------------------------------------------
cat > src/features/notes/local/noteMappers.ts <<'EOF'
import type { NoteRow } from '@/features/notes/local/noteRow';
import type {
  NoteResponse,
  NoteSummaryResponse,
  TrashedNoteResponse,
} from '@/features/notes/types';

/**
 * The single translation point between wire types and row types.
 *
 * Everything the server does not know about — localId, clientId, dirty,
 * syncState, localUpdatedAt — is added here and stripped here. One file, so
 * the question "does the server know about this field?" has one answer.
 */

/**
 * crypto.randomUUID: built in, cryptographically random, no dependency.
 *
 * Requires a secure context (https or localhost), which the app requires
 * anyway — a PWA cannot register a service worker without one.
 */
/**
 * Encodes a flag for storage.
 *
 * IndexedDB cannot index booleans, so every flag in an index is stored as
 * 0 | 1. Named rather than inlining `? 1 : 0` everywhere, so the reason lives
 * in one place and the call sites read as intent.
 */
export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function newLocalId(): string {
  return crypto.randomUUID();
}

/** Builds a row for a note that exists only locally. */
export function createLocalNote(
  ownerId: number | null,
  fields: { title?: string; content?: string } = {},
): NoteRow {
  const localId = newLocalId();

  return {
    localId,
    serverId: null,
    /*
     * clientId equals localId on creation, and they are still separate
     * fields.
     *
     * localId is OUR key and could in principle be reassigned; clientId is a
     * value we hand to the server and it echoes back forever. Collapsing them
     * would tie a local storage decision to a wire contract.
     */
    clientId: localId,
    title: fields.title ?? '',
    content: fields.content ?? '',
    pinned: 0,
    archived: 0,
    deleted: 0,
    version: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ownerId,
    lastModifiedBy: null,
    dirty: 1,
    syncState: 'pending',
    localUpdatedAt: Date.now(),
  };
}

/**
 * Applies a server response to a row.
 *
 * `existing` is passed so an update preserves localId and clientId — a note
 * that came back from the server is the SAME note, not a new one, and
 * replacing its local identity would orphan every reference to it (the open
 * editor, Step 8's queued operations).
 *
 * Marks the row clean, because by definition the server now holds this. A
 * caller that has newer local edits must not use this — see 7F.
 */
export function fromNoteResponse(note: NoteResponse, existing?: NoteRow): NoteRow {
  return {
    localId: existing?.localId ?? newLocalId(),
    serverId: note.id,
    clientId: existing?.clientId ?? newLocalId(),
    title: note.title ?? '',
    content: note.content ?? '',
    pinned: flag(note.pinned),
    archived: flag(note.archived),
    deleted: 0,
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: null,
    ownerId: note.ownerId,
    lastModifiedBy: note.lastModifiedBy,
    dirty: 0,
    syncState: 'synced',
    localUpdatedAt: Date.now(),
  };
}

/**
 * A summary carries no content, so an existing row's content is KEPT.
 *
 * Overwriting it with '' would empty every note the moment a list load
 * touched it — a data-loss bug that looks like the list working perfectly.
 */
export function fromNoteSummary(
  summary: NoteSummaryResponse,
  ownerId: number | null,
  existing?: NoteRow,
): NoteRow {
  return {
    localId: existing?.localId ?? newLocalId(),
    serverId: summary.id,
    clientId: existing?.clientId ?? newLocalId(),
    title: summary.title ?? '',
    content: existing?.content ?? '',
    pinned: flag(summary.pinned),
    archived: flag(summary.archived),
    deleted: 0,
    version: summary.version,
    createdAt: existing?.createdAt ?? null,
    updatedAt: summary.updatedAt,
    deletedAt: null,
    /*
     * THE OWNER COMES FROM THE CALLER, not from the summary — NoteSummaryResponse
     * has no ownerId field, and the previous `existing?.ownerId ?? null` was a
     * defect (7E): on a device with an empty database every row inserted by a
     * list refresh got ownerId null, and listActive(ownerId) — which queries the
     * [ownerId+deleted+archived] index — could never match it. A successful
     * fetch, rows in Dexie, and a permanently empty screen.
     *
     * The caller does know: it asked the server for THIS user's notes, so the
     * response is scoped by definition. Passing it makes that scoping explicit
     * instead of hoping a row already existed.
     */
    ownerId: existing?.ownerId ?? ownerId,
    lastModifiedBy: existing?.lastModifiedBy ?? null,
    dirty: existing?.dirty ?? 0,
    syncState: existing?.syncState ?? 'synced',
    localUpdatedAt: Date.now(),
  };
}

/**
 * A trashed note from GET /notes/trash.
 *
 * Built ON TOP of fromNoteSummary rather than beside it, because a trashed note
 * IS a summary — plus two facts the summary cannot carry. Duplicating the
 * fifteen fields would mean the next change to a note's local shape has two
 * places to remember and one of them will be missed.
 *
 * `deleted: 1` is the point: the same row the notes list uses, flagged, so the
 * trash is a QUERY over one table rather than a second table that has to be
 * kept consistent with the first. Restoring is one flag write.
 */
export function fromTrashedNote(
  trashed: TrashedNoteResponse,
  ownerId: number | null,
  existing?: NoteRow,
): NoteRow {
  return {
    ...fromNoteSummary(trashed.note, ownerId, existing),
    deleted: 1,
    deletedAt: trashed.deletedAt,
  };
}

/**
 * A row as the UI wants to read it.
 *
 * Deliberately NOT NoteResponse — the id may be null, which NoteResponse's
 * type forbids and which is a real state for an offline-created note. Callers
 * route by localId and treat serverId as an implementation detail.
 */
export interface NoteView {
  localId: string;
  serverId: number | null;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  version: number | null;
  updatedAt: string | null;
  /**
   * When the SERVER recorded the trashing, or null.
   *
   * Null does not mean "not trashed" — `archived`/`deleted` say that. It means
   * the server has not told us when, which is the normal state for a note
   * trashed on this device while offline. The trash screen renders a timestamp
   * only when there is one rather than inventing a local approximation, because
   * a local clock and the server's are not the same clock.
   */
  deletedAt: string | null;
  /** True when there are local edits the server has not accepted. */
  unsaved: boolean;
}

/**
 * A server summary rendered as a NoteView, WITHOUT a local row.
 *
 * This exists only for search, which is still server-only, and it is the
 * seam where that shows. The `localId` is synthetic — there is no row in
 * Dexie behind it — so it is safe as a React key and as nothing else. Nothing
 * may write to it, which is why search results are rendered without actions.
 *
 * 7G removes this function by settling whether search reads locally. Until
 * then it is better to have the compromise named and contained in one place
 * than spread through the search page as casts.
 */
export function viewFromSummary(summary: NoteSummaryResponse): NoteView {
  return {
    localId: `server-${String(summary.id)}`,
    serverId: summary.id,
    title: summary.title ?? '',
    // Summaries carry no content, and the card renders a preview from it.
    content: '',
    pinned: summary.pinned,
    archived: summary.archived,
    version: summary.version,
    updatedAt: summary.updatedAt,
    deletedAt: null,
    // A server result is by definition what the server holds.
    unsaved: false,
  };
}

export function toView(row: NoteRow): NoteView {
  return {
    localId: row.localId,
    serverId: row.serverId,
    title: row.title,
    content: row.content,
    /*
     * Decoded back to booleans HERE, and only here. 0 | 1 is a storage
     * encoding forced by IndexedDB; a component rendering a note should never
     * have to know that, and `pinned === 1` in JSX would be the encoding
     * leaking into the view.
     */
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    version: row.version,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    unsaved: row.dirty === 1,
  };
}
EOF

# ---------------------------------------------------------------------------
# 2. src/features/notes/local/noteRepository.ts
# ---------------------------------------------------------------------------
cat > src/features/notes/local/noteRepository.ts <<'EOF'
import { db } from '@/features/notes/local/database';
import {
  flag,
  fromNoteResponse,
  fromNoteSummary,
  fromTrashedNote,
} from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { META_KEYS } from '@/features/notes/local/metaRow';
import type {
  NoteResponse,
  NoteSummaryResponse,
  TrashedNoteResponse,
} from '@/features/notes/types';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * Every query and write against the local notes table.
 *
 * Not ceremony over db.notes — three things it prevents:
 *
 *   ENCODING LEAKS. 7A settled that flags are 0 | 1 for IndexedDB and boolean
 *   for the UI. A caller writing where('deleted').equals(false) gets an empty
 *   result with no error, forever.
 *
 *   UNBOUNDED WRITES. Reconciling a pull is read-merge-write, and outside a
 *   transaction a concurrent editor write between the read and the write is
 *   silently lost.
 *
 *   UNNAMED QUERIES. where('[ownerId+deleted+archived]').equals([1, 0, 0])
 *   does not explain itself, and the index it depends on is invisible from the
 *   call site.
 */

/**
 * Sorting happens in memory, not in the index.
 *
 * The list is ordered pinned-first then most-recently-touched, which is a
 * two-key sort with different directions — IndexedDB indexes are
 * single-direction, so expressing it as an index would mean storing an
 * inverted key. Sorting a few hundred rows in JS costs microseconds and keeps
 * the schema honest.
 *
 * If a user ever has enough notes for this to matter, the answer is a
 * paginated cursor over the index, not a cleverer key.
 */
function byPinnedThenRecent(a: NoteRow, b: NoteRow): number {
  if (a.pinned !== b.pinned) return b.pinned - a.pinned;
  return b.localUpdatedAt - a.localUpdatedAt;
}

/**
 * Most recently touched first, IGNORING pinned.
 *
 * The trash uses this rather than byPinnedThenRecent. Pinning is an
 * organisation of the notes you are working with, and a bin is not that — a
 * pinned note floating above the top of the trash tells the user nothing and
 * pushes the thing they just deleted, which is what they came to look at, down
 * the list. Since setDeleted restamps localUpdatedAt, "most recent" here means
 * "most recently trashed", which is the order this screen wants.
 */
function byRecent(a: NoteRow, b: NoteRow): number {
  return b.localUpdatedAt - a.localUpdatedAt;
}

export const noteRepository = {
  /** The main list: mine, not trashed, not archived. */
  async listActive(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .equals([ownerId, 0, 0])
      .toArray();
    return rows.sort(byPinnedThenRecent);
  },

  async listArchived(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .equals([ownerId, 0, 1])
      .toArray();
    return rows.sort(byPinnedThenRecent);
  },

  /**
   * The trash. Both archived states, because a note can be archived AND
   * trashed — they are orthogonal flags (Step 1's decision), so filtering on
   * one would hide half the bin.
   */
  async listTrashed(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .anyOf([
        [ownerId, 1, 0],
        [ownerId, 1, 1],
      ])
      .toArray();
    return rows.sort(byRecent);
  },

  getByLocalId(localId: string): Promise<NoteRow | undefined> {
    return db.notes.get(localId);
  },

  getByServerId(serverId: number): Promise<NoteRow | undefined> {
    return db.notes.where('serverId').equals(serverId).first();
  },

  /**
   * Finds a note by the id WE generated.
   *
   * The thread that stops a pull duplicating a note we created offline: the
   * server echoes clientId back, so a row arriving with an unfamiliar serverId
   * can still be recognised as one we already have.
   */
  getByClientId(clientId: string): Promise<NoteRow | undefined> {
    return db.notes.where('clientId').equals(clientId).first();
  },

  put(row: NoteRow): Promise<string> {
    return db.notes.put(row);
  },

  /**
   * Applies a local edit: writes the fields, marks the row dirty, and stamps
   * localUpdatedAt.
   *
   * A transaction because it is read-modify-write. Without one, two edits
   * landing in the same tick can both read the pre-edit row and the second
   * write wins wholesale — losing whichever field the first one changed.
   */
  applyLocalEdit(
    localId: string,
    changes: Partial<Pick<NoteRow, 'title' | 'content' | 'pinned' | 'archived'>>,
  ): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({
        ...existing,
        ...changes,
        dirty: 1,
        syncState: existing.syncState === 'conflict' ? 'conflict' : 'pending',
        localUpdatedAt: Date.now(),
      });
    });
  },

  /** Soft delete: the row stays, so a restore is local and instant. */
  setDeleted(localId: string, deleted: boolean): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({
        ...existing,
        deleted: flag(deleted),
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: Date.now(),
      });
    });
  },

  /**
   * Records that the server accepted a local change.
   *
   * THE GUARD IS THE WHOLE POINT. Between the local write and the server's
   * reply the user may have edited again, and clearing `dirty` unconditionally
   * would mark those newer edits as saved — they would never be pushed, and
   * the loss is silent and permanent.
   *
   * `expectedLocalUpdatedAt` is the stamp the row carried when the request went
   * out. If it still matches, nothing happened while we waited and the row is
   * genuinely clean. If it does not, we take the server's version (needed, or
   * the next write 409s) and LEAVE the row dirty for Step 8 to push.
   *
   * This is the same optimistic-concurrency idea as the server's @Version,
   * applied in the other direction: a token read before the write, compared
   * after it, to detect that someone else moved underneath you.
   */
  applyServerAck(
    localId: string,
    ack: { version: number | null; updatedAt: ServerDateTime | null; serverId?: number },
    expectedLocalUpdatedAt: number,
  ): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      const unchanged = existing.localUpdatedAt === expectedLocalUpdatedAt;

      await db.notes.put({
        ...existing,
        serverId: ack.serverId ?? existing.serverId,
        version: ack.version,
        updatedAt: ack.updatedAt,
        dirty: unchanged ? 0 : 1,
        syncState: unchanged ? 'synced' : 'pending',
        /*
         * localUpdatedAt is NOT restamped HERE. An acknowledgement is not a
         * local change — the server agreeing with us is not the user doing
         * something — and on the changed branch, restamping would destroy the
         * very evidence the next ack needs to compare against.
         *
         * The local write that preceded this one DID restamp, which 7E settled
         * deliberately: every local mutation must move the stamp or this guard
         * cannot see it. The cost is that pinning, archiving and deleting all
         * reorder the list, which is a smaller price than a silently unsent
         * write.
         */
      });
    });
  },

  /** Rows with local edits the server has not accepted. Step 8's push reads this. */
  listDirty(): Promise<NoteRow[]> {
    return db.notes.where('dirty').equals(1).toArray();
  },

  /**
   * Applies a server note to local storage.
   *
   * RETURNS WHAT IT DID rather than silently choosing, because the dirty case
   * is a policy decision and this layer does not own it:
   *
   *   'inserted' | 'updated' — the local row was clean, the server wins
   *   'skipped'              — the local row has unsent edits
   *
   * 7F decides what 'skipped' means (conflict, or local-wins, or merge). Doing
   * that here would bury the most consequential decision in the layer least
   * able to explain it.
   *
   * Matched by serverId FIRST, then clientId — a note we created offline is
   * found by the id we generated, before it has a server id we could match on.
   */
  upsertFromServer(note: NoteResponse): Promise<'inserted' | 'updated' | 'skipped'> {
    return db.transaction('rw', db.notes, async () => {
      /*
       * Matched by serverId only.
       *
       * clientId matching belongs to the SYNC pull, not here: NoteResponse has
       * no clientId field — only SyncNoteResponse carries it. Step 8 adds a
       * separate path that can match on it, and comparing against a stringified
       * server id here would be a lookup that never matches anything.
       */
      const existing = await db.notes.where('serverId').equals(note.id).first();

      if (!existing) {
        await db.notes.put(fromNoteResponse(note));
        return 'inserted';
      }

      if (existing.dirty === 1) return 'skipped';

      await db.notes.put(fromNoteResponse(note, existing));
      return 'updated';
    });
  },

  /**
   * Applies a page of list summaries.
   *
   * ONE transaction for the whole page, not one per row. A page is a single
   * observation of the server's state, and committing it row by row leaves a
   * window where the list is half-old and half-new — which useLiveQuery would
   * happily render.
   */
  upsertSummaries(summaries: NoteSummaryResponse[], ownerId: number | null): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      for (const summary of summaries) {
        const existing = await db.notes.where('serverId').equals(summary.id).first();

        // A summary carries no content, so a dirty row must not be touched at
        // all — fromNoteSummary preserves content, but overwriting title and
        // version on a row with unsent edits would lose them.
        if (existing?.dirty === 1) continue;

        await db.notes.put(fromNoteSummary(summary, ownerId, existing));
      }
    });
  },

  /**
   * Applies a page of the server's trash.
   *
   * Same shape as upsertSummaries and deliberately a SEPARATE method rather
   * than a flag on it: the two write opposite values for `deleted`, and a
   * boolean parameter at the call site would read as configuration when it is
   * actually the difference between "this note is in your notes" and "this note
   * is in your bin".
   *
   * Dirty rows are skipped for a sharper reason than in the notes list. A row
   * is dirty here mainly because the user just RESTORED it and the server has
   * not been told yet; letting a trash page that was fetched before that write
   * land on top would put the note straight back in the bin in front of them.
   *
   * WHAT THIS DOES NOT DO: remove local rows the server no longer lists as
   * trashed. A note restored or permanently deleted on another device stays in
   * this device's bin until something tells us otherwise. Reconciling absence
   * needs tombstones and a cursor, which is Step 8's pull — inventing a weaker
   * version here (delete anything not in the page) would wrongly evict every
   * note beyond the first page.
   */
  upsertTrashedNotes(trashed: TrashedNoteResponse[], ownerId: number | null): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      for (const entry of trashed) {
        const existing = await db.notes.where('serverId').equals(entry.note.id).first();

        if (existing?.dirty === 1) continue;

        await db.notes.put(fromTrashedNote(entry, ownerId, existing));
      }
    });
  },

  /** Removes a row entirely. For a permanent delete, or evicting a tombstone. */
  hardDelete(localId: string): Promise<void> {
    return db.notes.delete(localId);
  },

  async clear(): Promise<void> {
    await db.notes.clear();
  },
};

/** The sync cursor and other single values. Opaque to everything but Step 8. */
export const metaRepository = {
  async get<T>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  },

  /**
   * The sync cursor, kept as an opaque string.
   *
   * It is a LocalDateTime the server hands us and expects back byte for byte.
   * It must never touch lib/time.ts — parsing and re-serialising converts it
   * to UTC, shifting it by the local offset and skipping changes permanently.
   */
  getSyncCursor(): Promise<string | undefined> {
    return metaRepository.get<string>(META_KEYS.syncCursor);
  },

  setSyncCursor(cursor: string): Promise<void> {
    return metaRepository.set(META_KEYS.syncCursor, cursor);
  },
};
EOF

# ---------------------------------------------------------------------------
# 3. src/features/notes/hooks/useTrash.ts
# ---------------------------------------------------------------------------
cat > src/features/notes/hooks/useTrash.ts <<'EOF'
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { isAborted } from '@/lib/http/errors';

const PAGE_SIZE = 100;

/**
 * The trash, read from LOCAL STORAGE (7E).
 *
 * The last screen that still treated the network as the source of truth. It is
 * the same inversion useNotes went through in 7C, and the trash is where it
 * matters most for a reason that is easy to miss: a note deleted offline was
 * already gone from the notes list — with a server-only trash it was gone from
 * BOTH screens, so the user had no way to see it, let alone undo it. Deleting
 * offline meant the note vanished entirely until a sync that does not exist yet.
 *
 * WHAT CHANGED IN SHAPE. The old hook kept the list in React state and patched
 * it after every action (`remove(noteId)` before each request, `reload()` on
 * failure). All of that is gone. The row never leaves the table — `deleted` is
 * a flag — so restoring is one write and the live queries on both screens
 * re-run: the note disappears from the bin and reappears in the notes list
 * without either screen knowing the other exists.
 *
 * IDENTITY: notes are addressed by localId, not by server id. A note created
 * offline and then trashed has no server id at all, and the previous signature
 * (noteId: number) could not describe it.
 */
export interface TrashStateValue {
  /** Undefined while Dexie is still answering — NOT the same as an empty bin. */
  notes: NoteView[] | undefined;
  /** A background refresh is in flight. Content may already be on screen. */
  refreshing: boolean;
  /** The last refresh failed. Local rows are still shown. */
  refreshError: string | null;
  refresh: () => void;
  restore: (note: NoteView) => Promise<void>;
  deleteForever: (note: NoteView) => Promise<void>;
}

export function useTrash(): TrashStateValue {
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const rows = useLiveQuery(async () => {
    if (ownerId === null) return [];
    return noteRepository.listTrashed(ownerId);
  }, [ownerId]);

  useEffect(() => {
    if (ownerId === null) return;

    const controller = new AbortController();
    setRefreshing(true);

    noteService
      .listTrash({ page: 0, size: PAGE_SIZE, signal: controller.signal })
      .then(async (page) => {
        await noteRepository.upsertTrashedNotes(page.content, ownerId);
        setRefreshError(null);
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setRefreshError('Could not reach Notare. Showing what is in your trash on this device.');
      })
      .finally(() => {
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, [ownerId, refreshToken]);

  /**
   * Restore: LOCAL FIRST, exactly like pin and archive (7D).
   *
   * Clearing the flag is the operation; the request only informs the server. It
   * therefore works offline, and a failure needs no rollback — the row is
   * already correct, merely unsent, and listDirty() will find it in Step 8.
   */
  const restore = useCallback(
    async (note: NoteView) => {
      await noteRepository.setDeleted(note.localId, false);

      const written = await noteRepository.getByLocalId(note.localId);
      if (!written) return;

      toast.show({ message: 'Note restored.' });

      // Never created on the server, so there is nothing to restore there.
      if (written.serverId === null) return;

      try {
        const updated = await noteService.restoreNote(written.serverId);
        await noteRepository.applyServerAck(
          note.localId,
          { version: updated.version, updatedAt: updated.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        /*
         * Quiet, for the same reason pin is quiet: from the user's point of
         * view the restore worked, because it did. The note is back in their
         * notes list and the row is dirty. Saying "could not restore" would be
         * describing the network, not their note.
         */
      }
    },
    [toast],
  );

  /**
   * Permanent delete: SERVER FIRST. The deliberate exception to local-first.
   *
   * Every other write in this app is local-first because the local row can hold
   * the intent until the server hears about it. This one cannot. There is no
   * "pending permanent delete" state — the row's whole job is to represent a
   * note, and the operation's job is to stop the note existing. Deleting the row
   * optimistically and failing the request would remove the note from this
   * device while it lives on every other one, and the next list refresh would
   * bring it back with no explanation.
   *
   * So the server decides, and offline this action honestly fails. It is
   * irreversible and there is no undo to offer; a false success would be the
   * worst possible lie here.
   *
   * A note with no serverId is the one case that IS purely local: the server has
   * never heard of it, so dropping the row completes the operation.
   */
  const deleteForever = useCallback(
    async (note: NoteView) => {
      const row = await noteRepository.getByLocalId(note.localId);
      if (!row) return;

      if (row.serverId === null) {
        await noteRepository.hardDelete(note.localId);
        toast.show({ message: 'Note deleted permanently.' });
        return;
      }

      try {
        await noteService.permanentlyDeleteNote(row.serverId);
      } catch {
        toast.show({ message: 'Could not delete that note. You need a connection for this.' });
        return;
      }

      /*
       * hardDelete, not setDeleted. The row is not a tombstone: the server has
       * forgotten this note, so a local row could never be reconciled with
       * anything. Keeping it would leave a permanently unmatchable ghost in
       * every sync.
       */
      await noteRepository.hardDelete(note.localId);
      // NO undo offered, because there is none. Any affordance suggesting
      // otherwise would be a lie.
      toast.show({ message: 'Note deleted permanently.' });
    },
    [toast],
  );

  return {
    notes: rows?.map(toView),
    refreshing,
    refreshError,
    refresh,
    restore,
    deleteForever,
  };
}
EOF

# ---------------------------------------------------------------------------
# 4. src/features/notes/hooks/useDeleteNote.ts  (settles the localUpdatedAt question)
# ---------------------------------------------------------------------------
cat > src/features/notes/hooks/useDeleteNote.ts <<'EOF'
import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';

/**
 * Moves a note to the trash, with an undo.
 *
 * The `onRemove` callback is gone for the same reason it went from
 * useNoteActions: the list is a live query, so setting `deleted` on the row
 * removes the note from every view that filters on it. The old hook's most
 * delicate behaviour — "reinsert at the original index on undo" — is gone with
 * it, because the row never leaves the table.
 *
 * 7E SETTLES THE STAMP. setDeleted DOES restamp localUpdatedAt (an earlier
 * version of this comment claimed otherwise), so a note deleted and then undone
 * comes back at the TOP of the list rather than where it was. That is
 * deliberate, and the alternative is worse: applyServerAck's guard compares the
 * stamp taken before a request against the row after it, and a mutation that
 * does not move the stamp is a mutation the guard cannot see — a delete
 * acknowledged after an undo would mark the undone row clean and it would never
 * be pushed. The list order is the cheaper thing to give up, and "the note you
 * just touched is at the top" is defensible on its own terms. The trash orders
 * by the same stamp, which is exactly what that screen wants: most recently
 * trashed first.
 *
 * ORDER: local write first, request second. That was already true, but it used
 * to be a UX choice with a rollback behind it. Now it is the architecture —
 * the local write is the operation, and the request only informs the server.
 */
export function useDeleteNote() {
  const toast = useToast();

  return useCallback(
    async (note: NoteView) => {
      const label = note.title.trim();

      await noteRepository.setDeleted(note.localId, true);

      const written = await noteRepository.getByLocalId(note.localId);

      toast.show({
        message: label === '' ? 'Note moved to trash.' : `“${label}” moved to trash.`,
        action: {
          label: 'Undo',
          onAction: () => {
            toast.dismiss();
            void noteRepository.setDeleted(note.localId, false).then(async () => {
              if (written?.serverId == null) return;
              // Best-effort. If it fails the row is un-deleted locally and
              // dirty, which Step 8 reconciles.
              await noteService.restoreNote(written.serverId).catch(() => undefined);
            });
          },
        },
      });

      if (written?.serverId == null) {
        /*
         * Never created on the server, so there is nothing to soft-delete
         * there. The row is a local tombstone; Step 8 decides whether it is
         * pushed as a delete or simply dropped, since the server has never
         * heard of this note.
         */
        return;
      }

      try {
        await noteService.softDeleteNote(written.serverId);
        await noteRepository.applyServerAck(
          note.localId,
          { version: note.version, updatedAt: note.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        // The note is in the local trash and dirty. It is not lost, and the
        // user's action stands — telling them it failed would be misleading.
      }
    },
    [toast],
  );
}
EOF

# ---------------------------------------------------------------------------
# 5. src/pages/Trash/Trash.tsx
# ---------------------------------------------------------------------------
cat > src/pages/Trash/Trash.tsx <<'EOF'
import { useState } from 'react';

import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useTrash } from '@/features/notes/hooks/useTrash';
import { Button } from '@/design-system/components/Button/Button';
import { formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Trash.css';

export function TrashPage() {
  useDocumentTitle('Trash');

  const { notes, refreshing, refreshError, refresh, restore, deleteForever } = useTrash();

  /*
   * Confirmation is keyed by localId, not by server id. A note trashed while
   * offline has no server id, and the previous `number | null` could not
   * address it — the delete-forever confirmation simply would not open.
   */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <section className="trash">
      <h1>Trash</h1>
      <NoteTabs />

      {/*
        NO countdown, and no "deleted in 30 days". Nothing on the server purges
        trashed notes — SyncRetentionJob sweeps the sync tables only — so a
        promise like that would be a lie the user acts on.
      */}
      <p className="trash__lead">Notes stay here until you delete them permanently.</p>

      {/*
        A BANNER, not a screen (the same inversion as the notes list). What is
        in the local bin stays readable, and a failed refresh is an aside.
      */}
      {refreshError !== null ? (
        <p className="trash__offline" role="status">
          {refreshError}{' '}
          <button className="trash__retry" type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}

      {/*
        `notes === undefined` is Dexie not having answered yet — milliseconds,
        and a spinner for it flashes on every mount. An empty ARRAY is a
        genuinely empty bin. Conflating them shows "your trash is empty" before
        the query has run.
      */}
      {notes !== undefined && notes.length === 0 && !refreshing ? (
        <div className="trash__centre">
          <p>Your trash is empty.</p>
        </div>
      ) : null}

      {notes !== undefined && notes.length > 0 ? (
        <ul className="trash__list" role="list">
          {notes.map((note) => {
            const title = note.title.trim();
            const label = title === '' ? 'Untitled' : title;

            return (
              <li className="trash__item" key={note.localId}>
                <div>
                  {/* No link: a trashed note has no detail view to open. */}
                  <p className="trash__title">{label}</p>
                  {note.deletedAt !== null ? (
                    <p className="trash__meta">
                      Trashed {formatServerDateTimeRelative(note.deletedAt)}
                    </p>
                  ) : (
                    /*
                      No server timestamp yet, which is the normal state for a
                      note trashed offline. Saying so beats inventing a time
                      from a clock the server never agreed with.
                    */
                    <p className="trash__meta">Trashed on this device</p>
                  )}
                </div>

                <div className="trash__actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Restore ${label}`}
                    onClick={() => void restore(note)}
                  >
                    Restore
                  </Button>

                  {confirmingId === note.localId ? (
                    <>
                      {/*
                        The wording IS the confirmation. "Confirm" would be
                        ambiguous for something irreversible — this says
                        exactly what the click does.
                      */}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setConfirmingId(null);
                          void deleteForever(note);
                        }}
                      >
                        Delete forever
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConfirmingId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Permanently delete ${label}`}
                      onClick={() => {
                        setConfirmingId(note.localId);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
EOF

# ---------------------------------------------------------------------------
# 6. src/pages/Trash/Trash.css
# ---------------------------------------------------------------------------
cat > src/pages/Trash/Trash.css <<'EOF'
@layer pages {
  .trash {
    max-inline-size: var(--measure-prose);
    margin-inline: auto;
    padding: var(--space-8) var(--space-4);
  }

  .trash__lead,
  .trash__meta {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .trash__list {
    display: grid;
    gap: var(--space-3);
    margin-block-start: var(--space-6);
    padding: 0;
  }

  .trash__item {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    background-color: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .trash__title {
    margin: 0;
    font-weight: var(--font-weight-medium);
  }

  .trash__meta {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-xs);
  }

  .trash__actions {
    display: flex;
    gap: var(--space-2);
  }

  .trash__offline {
    margin-block-start: var(--space-4);
    padding: var(--space-3) var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    background-color: var(--color-accent-subtle);
    border-radius: var(--radius-md);
  }

  .trash__retry {
    padding: 0;
    color: var(--color-accent);
    font: inherit;
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }

  .trash__centre {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding-block: var(--space-16);
    text-align: center;
    color: var(--color-text-secondary);
  }
}
EOF

# ---------------------------------------------------------------------------
# 7. src/pages/Trash/Trash.test.tsx
# ---------------------------------------------------------------------------
cat > src/pages/Trash/Trash.test.tsx <<'EOF'
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { TrashPage } from '@/pages/Trash/Trash';
import { makeNoteSummary, makePage, makeRow } from '~/fixtures/notes';
import { SignedIn, seedNotes } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

function renderTrash() {
  const router = createMemoryRouter([{ path: '/trash', element: <TrashPage /> }], {
    initialEntries: ['/trash'],
  });
  return render(
    <SignedIn>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SignedIn>,
  );
}

describe('the trash', () => {
  it('lists locally trashed notes without promising they expire', async () => {
    // serverId 91, not 9: the default handler's trash page holds note 9, and a
    // clean row would be overwritten by it mid-test.
    await seedNotes(makeRow({ serverId: 91, title: 'Old draft', deleted: 1 }));

    renderTrash();

    expect(await screen.findByText('Old draft')).toBeInTheDocument();

    /*
     * Nothing on the server purges trashed notes — SyncRetentionJob sweeps the
     * sync tables only. A "deleted in 30 days" countdown would be a lie the
     * user acts on by not restoring something.
     */
    expect(screen.getByText(/until you delete them permanently/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bin \d+ days?\b/i)).not.toBeInTheDocument();
  });

  it('shows a note trashed offline, which a server-only trash could not', async () => {
    /*
     * The defect 7E closes. Before this the bin was a GET: a note deleted with
     * no connection was gone from the notes list AND absent from the trash, so
     * there was nowhere to undo it from.
     */
    server.use(http.get(`${BASE}/notes/trash`, () => HttpResponse.error()));

    await seedNotes(makeRow({ serverId: null, title: 'Written on a plane', deleted: 1, dirty: 1 }));

    renderTrash();

    expect(await screen.findByText('Written on a plane')).toBeInTheDocument();
    // The failure is a banner beside the notes, not instead of them.
    expect(await screen.findByText(/showing what is in your trash on this device/i)).toBeVisible();
  });

  it('writes the server trash into local storage, scoped to the owner', async () => {
    /*
     * Guards the ownerId regression fixed in 7E: a summary carries no ownerId,
     * so a row inserted on an empty device used to get null and could never
     * match the [ownerId+deleted+archived] query. The fetch succeeded and the
     * screen stayed empty.
     */
    server.use(
      http.get(`${BASE}/notes/trash`, () =>
        HttpResponse.json(
          makePage([
            {
              note: makeNoteSummary({ id: 21, title: 'From the server' }),
              deletedAt: '2026-08-05T14:00:00.000',
            },
          ]),
        ),
      ),
    );

    renderTrash();

    expect(await screen.findByText('From the server')).toBeInTheDocument();

    const stored = await noteRepository.getByServerId(21);
    expect(stored?.ownerId).toBe(1);
    expect(stored?.deleted).toBe(1);
    expect(stored?.deletedAt).toBe('2026-08-05T14:00:00.000');
  });

  it('requires a second click before deleting forever', async () => {
    let deleted = false;
    server.use(
      http.delete(`${BASE}/notes/:noteId/permanent`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await seedNotes(makeRow({ serverId: 9, title: 'Note 9', deleted: 1 }));

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /permanently delete note 9/i }));
    expect(deleted).toBe(false);

    // The wording IS the confirmation — "Confirm" would be ambiguous for
    // something irreversible.
    await user.click(screen.getByRole('button', { name: /delete forever/i }));
    await waitFor(() => {
      expect(deleted).toBe(true);
    });

    // hardDelete, not a flag: the server has forgotten this note, so a local
    // row could never be reconciled with anything.
    await waitFor(async () => {
      expect(await noteRepository.getByServerId(9)).toBeUndefined();
    });
  });

  it('keeps the note when a permanent delete fails, because there is no undo', async () => {
    server.use(http.delete(`${BASE}/notes/:noteId/permanent`, () => HttpResponse.error()));

    await seedNotes(makeRow({ serverId: 9, title: 'Note 9', deleted: 1 }));

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /permanently delete note 9/i }));
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    expect(await screen.findByText(/you need a connection/i)).toBeInTheDocument();
    // Still there. A local-first delete would have removed it here and left the
    // note alive on every other device.
    expect(await noteRepository.getByServerId(9)).toBeDefined();
  });

  it('restores locally first, so it works with no connection', async () => {
    server.use(http.post(`${BASE}/notes/:noteId/restore`, () => HttpResponse.error()));

    const row = makeRow({ serverId: 9, title: 'Note 9', deleted: 1 });
    await seedNotes(row);

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    expect(await screen.findByText(/note restored/i)).toBeInTheDocument();

    await waitFor(async () => {
      const stored = await noteRepository.getByLocalId(row.localId);
      expect(stored?.deleted).toBe(0);
      // Unsent, not lost: Step 8's push finds it through listDirty().
      expect(stored?.dirty).toBe(1);
    });
  });

  it('adopts the version the server returns on a successful restore', async () => {
    const row = makeRow({ serverId: 9, title: 'Note 9', deleted: 1, version: 3 });
    await seedNotes(row);

    const user = userEvent.setup();
    renderTrash();

    await user.click(await screen.findByRole('button', { name: /restore note 9/i }));

    await waitFor(async () => {
      const stored = await noteRepository.getByLocalId(row.localId);
      expect(stored?.dirty).toBe(0);
      expect(stored?.syncState).toBe('synced');
    });
  });
});
EOF

# ---------------------------------------------------------------------------
# 8. Six surgical edits. These files change by one line (or one inserted block),
#    so they are patched in place rather than reprinted in full — the paths are
#    explicit and each replacement is exact.
# ---------------------------------------------------------------------------
python3 - <<'PY'
import sys

def patch(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        if old not in s:
            sys.exit(f"NOT FOUND in {path}:\n{old[:120]}")
        s = s.replace(old, new, 1)
    open(path, 'w').write(s)
    print("patched", path)

# --- useNotes: pass the owner into the write path -------------------------
patch('src/features/notes/hooks/useNotes.ts', [(
    "await noteRepository.upsertSummaries(page.content);",
    "await noteRepository.upsertSummaries(page.content, ownerId);",
)])

# --- router: register /archived and /trash --------------------------------
patch('src/app/router.tsx', [("""          {
            path: 'notes',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              return { Component: NotesPage };
            },
          },""", """          {
            path: 'notes',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              return { Component: NotesPage };
            },
          },

          /*
           * 7E. NoteTabs has linked to both of these since Step 5 and both
           * rendered the 404 page, because the route tree was never told they
           * existed — the pages' own tests mounted them in a memory router, so
           * nothing failed. A test that builds its own routes proves the page
           * works, not that the app can reach it.
           */
          {
            path: 'archived',
            lazy: async () => {
              const { NotesPage } = await import('@/pages/Notes/Notes');
              /*
               * A route cannot pass props to a `Component`, so the prop is
               * bound here. The wrapper is created ONCE, when lazy resolves and
               * the router caches the result — not per render, which would give
               * React a new component type each time and remount the page on
               * every state change.
               */
              return { Component: () => <NotesPage archived /> };
            },
          },
          {
            path: 'trash',
            lazy: async () => {
              const { TrashPage } = await import('@/pages/Trash/Trash');
              return { Component: TrashPage };
            },
          },""")])

# --- Notes.css: the offline banner had markup and no styles ---------------
s = open('src/pages/Notes/Notes.css').read()
block = """
  /*
   * The offline banner. 7C added the markup and no styles, so the failure
   * message rendered as bare body text indistinguishable from the note list
   * above it — visible, but not legible AS a status.
   */
  .notes__offline {
    margin-block-start: var(--space-4);
    padding: var(--space-3) var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    background-color: var(--color-accent-subtle);
    border-radius: var(--radius-md);
  }

  .notes__retry {
    padding: 0;
    color: var(--color-accent);
    font: inherit;
    background: none;
    border: 0;
    text-decoration: underline;
    cursor: pointer;
  }
"""
idx = s.rstrip().rfind('}')
open('src/pages/Notes/Notes.css','w').write(s[:idx] + block + s[idx:])
print("patched src/pages/Notes/Notes.css")

# --- Notes.test: two tests relied on the ownerId bug swallowing note 2 -----
patch('src/pages/Notes/Notes.test.tsx', [
    ("import { makeRow } from '~/fixtures/notes';",
     "import { makePage, makeRow } from '~/fixtures/notes';"),
    ("const BASE = 'http://localhost:2001/api/v1';", """const BASE = 'http://localhost:2001/api/v1';

/**
 * The server has nothing beyond what this test seeded.
 *
 * Needed since 7E. The default handler returns notes 1 and 2, and until 7E the
 * rows it inserted carried ownerId null — invisible to a query scoped by owner,
 * so a test could assert an empty list while two notes sat in the database. Now
 * the refresh inserts them correctly, which means a test about ONE note has to
 * say so rather than relying on the other being swallowed.
 */
function serverHasNoNotes() {
  server.use(http.get(`${BASE}/notes`, () => HttpResponse.json(makePage([]))));
}"""),
    ("""  it('moves a note to the trash and offers an undo', async () => {
    await seedNotes(""", """  it('moves a note to the trash and offers an undo', async () => {
    serverHasNoNotes();
    await seedNotes("""),
    ("""  it('archiving removes the note from the main list', async () => {
    await seedNotes(""", """  it('archiving removes the note from the main list', async () => {
    serverHasNoNotes();
    await seedNotes("""),
])

# --- database.test: fromNoteSummary signature -----------------------------
patch('src/features/notes/local/database.test.ts', [(
    "fromNoteSummary(makeNoteSummary({ id: 4, title: 'Renamed' }), existing);",
    "fromNoteSummary(makeNoteSummary({ id: 4, title: 'Renamed' }), 1, existing);",
)])

# --- noteRepository.test: signature + three new cases ---------------------
patch('src/features/notes/local/noteRepository.test.ts', [
    ("await noteRepository.upsertSummaries([makeNoteSummary({ id: 3, title: 'server title' })]);",
     "await noteRepository.upsertSummaries([makeNoteSummary({ id: 3, title: 'server title' })], 1);"),
    ("""    expect((await noteRepository.getByServerId(3))?.title).toBe('my rename');
  });
});""", """    expect((await noteRepository.getByServerId(3))?.title).toBe('my rename');
  });

  it('stamps the owner on rows a list page inserts', async () => {
    /*
     * 7E. A summary has no ownerId, and the mapper used to fall back to null
     * when there was no existing row. Every read is scoped by owner through
     * the [ownerId+deleted+archived] index, so a null-owned row is invisible —
     * on a fresh device the fetch succeeded and the list stayed empty forever.
     */
    await noteRepository.upsertSummaries([makeNoteSummary({ id: 30 })], 7);

    expect((await noteRepository.getByServerId(30))?.ownerId).toBe(7);
    expect(await noteRepository.listActive(7)).toHaveLength(1);
  });

  it('marks a trash page as deleted and keeps it out of the notes list', async () => {
    await noteRepository.upsertTrashedNotes(
      [{ note: makeNoteSummary({ id: 31 }), deletedAt: '2026-08-05T14:00:00.000' }],
      7,
    );

    const stored = await noteRepository.getByServerId(31);
    expect(stored?.deleted).toBe(1);
    expect(stored?.deletedAt).toBe('2026-08-05T14:00:00.000');

    // One table, two queries. The trash is a filter, not a second store.
    expect(await noteRepository.listActive(7)).toHaveLength(0);
    expect(await noteRepository.listTrashed(7)).toHaveLength(1);
  });

  it('does not re-trash a note the user has just restored', async () => {
    /*
     * The restore wrote locally and left the row dirty. A trash page fetched
     * before that write must not land on top of it and put the note back in
     * the bin in front of the user.
     */
    const local = fromNoteResponse(makeNote({ id: 32 }));
    await db.notes.put({ ...local, ownerId: 7, deleted: 0, dirty: 1 });

    await noteRepository.upsertTrashedNotes(
      [{ note: makeNoteSummary({ id: 32 }), deletedAt: '2026-08-05T14:00:00.000' }],
      7,
    );

    expect((await noteRepository.getByServerId(32))?.deleted).toBe(0);
  });
});"""),
])
PY

npm run typecheck && npx eslint src tests && npx prettier --check src && npm test