import { encodeUpdate } from '@/features/collab/collabProtocol';
import { collabStore } from '@/features/collab/collabStore';

interface UpdateQueueOptions {
  /** The server id of the note. */
  noteId: number;
  /** Sends one frame. False when the socket is not open. */
  send: (frame: Uint8Array) => boolean;
  /** True once the server has accepted our JOIN. */
  joined: () => boolean;
}

/**
 * Local Yjs updates on their way to the server. Each one is written to the device first
 * (pendingUpdates) and only then sent; its row is deleted when the ACK arrives. So an app kill or a
 * dropped connection loses nothing: whatever is unacknowledged goes out again, oldest first, after
 * the next join. Writes and sends happen one at a time, so updates leave in the order they were made.
 */
export class UpdateQueue {
  private readonly noteId: number;
  private readonly send: (frame: Uint8Array) => boolean;
  private readonly joined: () => boolean;
  /** Ids sent and not yet settled. The server answers in the order it received them. */
  private readonly awaitingAck: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(options: UpdateQueueOptions) {
    this.noteId = options.noteId;
    this.send = options.send;
    this.joined = options.joined;
  }

  /** Store an update, and send it if connected. */
  add(update: Uint8Array): void {
    this.enqueue(async () => {
      const id = await collabStore.addPending(this.noteId, update);
      this.sendRow(id, update);
    });
  }

  /** After a join: send everything still unacknowledged. */
  flush(): void {
    this.enqueue(async () => {
      for (const row of await collabStore.pending(this.noteId)) {
        if (row.id !== undefined) this.sendRow(row.id, row.bytes);
      }
    });
  }

  /** The server answered the oldest sent update: acknowledged, or refused because the person is now a viewer. */
  settle(): void {
    const id = this.awaitingAck.shift();
    if (id !== undefined) void collabStore.removePending(id);
  }

  /** The socket is gone. What was not acknowledged stays stored and is sent again after the next join. */
  connectionLost(): void {
    this.awaitingAck.length = 0;
  }

  private enqueue(task: () => Promise<void>): void {
    this.chain = this.chain.then(task).catch(() => undefined);
  }

  private sendRow(id: number, update: Uint8Array): void {
    if (!this.joined() || this.awaitingAck.includes(id)) return;
    try {
      if (this.send(encodeUpdate(update))) this.awaitingAck.push(id);
    } catch {
      void collabStore.removePending(id); // Over the frame limit: it could never be sent.
    }
  }
}
