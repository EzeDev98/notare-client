import type { Awareness } from 'y-protocols/awareness';
import { applyUpdate, encodeStateAsUpdate, type Doc } from 'yjs';

import { COLLAB_CLOSE_DELAY_MS, COLLAB_SNAPSHOT_EVERY_UPDATES } from '@/core/config/timings';
import { relayAwareness, type AwarenessRelay } from '@/features/collab/awarenessRelay';
import { countWords } from '@/features/collab/wordCount';
import { CollabConnection, type ConnectionStatus } from '@/features/collab/CollabConnection';
import {
  ERROR_CODE,
  decodeServerFrame,
  encodeSnapshot,
  type CollabRole,
  type ServerFrame,
} from '@/features/collab/collabProtocol';
import { collabStore } from '@/features/collab/collabStore';
import { requestCollabTicket } from '@/features/collab/collabTicket';
import { REMOTE } from '@/features/collab/origin';
import { UpdateQueue } from '@/features/collab/UpdateQueue';

/** An update with no content encodes to two bytes: nothing worth sending. */
const EMPTY_UPDATE_BYTES = 2;

export type CollabStatus = ConnectionStatus | 'synced';

export interface CollabState {
  status: CollabStatus;
  /** The role the server last gave, or null before the first ticket. */
  role: CollabRole | null;
  /** What happened to the note while the device was offline, once it has synced again (step 16i). */
  merge?: MergeOutcome | undefined;
}

export type MergeKind = 'merged' | 'saved' | 'caughtUp';

/** Each outcome has a new id, so the same kind twice in a row is still news. */
export interface MergeOutcome {
  id: number;
  kind: MergeKind;
  /** For caughtUp: how many words other people added. */
  words: number;
}

export interface CollabProviderOptions {
  /** The server id of the note. */
  noteId: number;
  doc: Doc;
  awareness: Awareness;
  /** The note's plain text, sent with each SNAPSHOT. */
  plainText: (doc: Doc) => string;
  /** Replaceable so a fake can stand in for the network. */
  requestTicket?: typeof requestCollabTicket;
  createSocket?: (url: string) => WebSocket;
}

const canWrite = (role: CollabRole | null): boolean => role === 'owner' || role === 'editor';

/**
 * Live editing for one open note (step 16b; the wire format is collabProtocol.ts).
 *
 * Everything from the server is applied with the origin REMOTE and never sent back; every other
 * change goes through the UpdateQueue. The provider connects only when told to (`connect`); the
 * caller decides when: note open, tab visible, device online.
 */
export class CollabProvider {
  private state: CollabState = { status: 'idle', role: null };
  private readonly listeners = new Set<() => void>();
  private joined = false;
  private released = false;
  private lastSeq = 0;
  private sinceSnapshot = 0;
  private snapshotsOff = false;
  // What happened while offline (step 16i).
  private everSynced = false;
  private offline = false;
  private editedOffline = false;
  private remoteSinceOpen = false;
  private wordsBefore = 0;
  private mergeCount = 0;
  private readonly doc: Doc;
  private readonly noteId: number;
  private readonly plainText: (doc: Doc) => string;
  private readonly connection: CollabConnection;
  private readonly queue: UpdateQueue;
  private readonly relay: AwarenessRelay;

  constructor(options: CollabProviderOptions) {
    this.doc = options.doc;
    this.noteId = options.noteId;
    this.plainText = options.plainText;
    this.connection = new CollabConnection({
      noteId: options.noteId,
      requestTicket: options.requestTicket ?? requestCollabTicket,
      createSocket: options.createSocket ?? ((url) => new WebSocket(url)),
      onOpening: (role, lastSeq) => {
        this.lastSeq = lastSeq;
        this.setState({ role });
        // Coming back after being offline: count the words now, before the missed updates arrive.
        if (this.offline) {
          this.remoteSinceOpen = false;
          this.wordsBefore = countWords(this.plainText(this.doc));
        }
      },
      onFrame: (data) => {
        this.onFrame(data);
      },
      onStatus: (status) => {
        this.setState({ status });
      },
      onLost: () => {
        this.joined = false;
        if (this.everSynced && !navigator.onLine) this.offline = true;
        this.queue.connectionLost();
        this.relay.forgetRemote();
      },
    });
    const send = (frame: Uint8Array): boolean => this.connection.send(frame);
    const joined = (): boolean => this.joined;
    this.queue = new UpdateQueue({ noteId: options.noteId, send, joined });
    this.relay = relayAwareness(options.awareness, send, joined);
    this.doc.on('update', this.onLocalUpdate);
  }

  // ---- State, for useSyncExternalStore ------------------------------------

  readonly getState = (): CollabState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(patch: Partial<CollabState>): void {
    if (this.released) return;
    const next = { ...this.state, ...patch };
    if (next.status === this.state.status && next.role === this.state.role && next.merge === this.state.merge) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  // ---- Lifecycle -----------------------------------------------------------

  /** Start, or resume, the connection. Safe to call again. */
  connect(): void {
    if (!this.released) this.connection.connect();
  }

  /** Stop the connection, for example when the tab is hidden or the device goes offline. */
  disconnect(): void {
    this.connection.disconnect();
  }

  /**
   * The note was left. Local changes are no longer captured (the document is going away), editors
   * send a last SNAPSHOT, and the socket closes a few seconds later so acknowledgements still arrive.
   */
  release(): void {
    if (this.released) return;
    this.released = true;
    this.doc.off('update', this.onLocalUpdate);
    this.maybeSnapshot(true);
    this.relay.leave();
    this.connection.closeAfter(COLLAB_CLOSE_DELAY_MS);
  }

  // ---- Frames from the server ---------------------------------------------

  private onFrame(data: Uint8Array): void {
    let frame: ServerFrame;
    try {
      frame = decodeServerFrame(data);
    } catch {
      return; // The server never sends a bad frame; a stray one is not worth a dropped connection.
    }
    switch (frame.type) {
      case 'update':
        this.applyRemote(frame.update, frame.seq);
        this.sinceSnapshot += 1;
        break;
      case 'snapshot':
        this.applyRemote(frame.state, frame.upToSeq);
        break;
      case 'awareness':
        this.relay.receive(frame.payload);
        break;
      case 'role':
        this.setState({ role: frame.role });
        break;
      case 'ack':
        this.queue.settle();
        this.advance(frame.seq);
        this.sinceSnapshot += 1;
        this.maybeSnapshot();
        break;
      case 'synced':
        this.onSynced(frame.head);
        break;
      case 'error':
        this.onError(frame.code);
        break;
    }
  }

  private applyRemote(bytes: Uint8Array, seq: number): void {
    try {
      applyUpdate(this.doc, bytes, REMOTE);
    } catch {
      return; // A corrupt update is skipped, and its seq is not recorded as held.
    }
    if (this.offline) this.remoteSinceOpen = true;
    this.advance(seq);
  }

  private advance(seq: number): void {
    if (seq <= this.lastSeq) return;
    this.lastSeq = seq;
    void collabStore.setLastSeq(this.noteId, seq);
  }

  private onSynced(head: number): void {
    if (head < this.lastSeq) {
      // The server's history is behind ours (for example a restored database): start over from 0.
      this.lastSeq = 0;
      void collabStore.setLastSeq(this.noteId, 0).then(() => {
        this.connection.restart();
      });
      return;
    }
    this.joined = true;
    this.connection.joined();
    this.setState({ status: 'synced' });
    // A note the server has never heard of gets the whole document as its first update.
    const state = encodeStateAsUpdate(this.doc);
    if (head === 0 && canWrite(this.state.role) && state.length > EMPTY_UPDATE_BYTES) this.queue.add(state);
    this.queue.flush();
    this.maybeSnapshot();
    this.relay.announce();
    this.announceMerge();
    this.everSynced = true;
  }

  /**
   * After being offline: your edits and theirs were merged, yours were just saved, or you caught up
   * on theirs. N is the difference in words before and after their updates were applied.
   */
  private announceMerge(): void {
    if (!this.offline) return;
    const mine = this.editedOffline;
    const theirs = this.remoteSinceOpen;
    const words = countWords(this.plainText(this.doc)) - this.wordsBefore;
    this.offline = false;
    this.editedOffline = false;
    this.remoteSinceOpen = false;

    let kind: MergeKind | null = null;
    if (mine && theirs) kind = 'merged';
    else if (mine) kind = 'saved';
    else if (theirs && words > 0) kind = 'caughtUp';
    if (kind === null) return;
    this.mergeCount += 1;
    this.setState({ merge: { id: this.mergeCount, kind, words: Math.max(0, words) } });
  }

  private onError(code: number): void {
    if (code === ERROR_CODE.READ_ONLY) {
      // The refused update was not stored: it is dropped, and the editor turns read-only.
      this.queue.settle();
      this.setState({ role: 'viewer' });
    } else if (code === ERROR_CODE.BAD_SNAPSHOT) {
      this.snapshotsOff = true;
    } else {
      this.connection.fail(); // Server error or a protocol slip: reconnect through the backoff.
    }
  }

  // ---- Updates to the server ----------------------------------------------

  private readonly onLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === REMOTE || this.state.role === 'viewer') return;
    if (this.everSynced && !this.joined) this.editedOffline = true;
    this.queue.add(update);
  };

  /** Editors compact the log after enough updates, and once more when the note is closed. */
  private maybeSnapshot(closing = false): void {
    const due = closing ? this.sinceSnapshot > 0 : this.sinceSnapshot > COLLAB_SNAPSHOT_EVERY_UPDATES;
    if (!due || !this.joined || this.snapshotsOff || this.lastSeq < 1 || !canWrite(this.state.role)) return;
    try {
      const state = encodeStateAsUpdate(this.doc);
      const plainText = this.plainText(this.doc);
      if (this.connection.send(encodeSnapshot({ upToSeq: this.lastSeq, state, plainText }))) this.sinceSnapshot = 0;
    } catch {
      this.snapshotsOff = true;
    }
  }
}
