import { SYNC_BACKOFF_MS } from '@/core/config/timings';
import { CLOSE_CODE, encodeJoin, type CollabRole } from '@/features/collab/collabProtocol';
import { collabStore } from '@/features/collab/collabStore';
import { collabSocketUrl, requestCollabTicket } from '@/features/collab/collabTicket';
import { isForbidden, isNotFound } from '@/lib/http/errors';

export type ConnectionStatus = 'idle' | 'connecting' | 'retrying' | 'revoked';

export interface CollabConnectionOptions {
  /** The server id of the note. */
  noteId: number;
  requestTicket: typeof requestCollabTicket;
  createSocket: (url: string) => WebSocket;
  /** The ticket was granted: the role it carries and the last seq this device holds. JOIN follows. */
  onOpening: (role: CollabRole, lastSeq: number) => void;
  onFrame: (data: Uint8Array) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** The socket is gone, for any reason: whatever depended on it stands down. */
  onLost: () => void;
}

/**
 * The socket for one note: a ticket, the connection, JOIN, and reconnecting with the backoff list
 * from step 7. It does not know what the frames mean. A refused ticket (404, 403) or close code 4403
 * means access is gone: it marks itself revoked and never reconnects.
 */
export class CollabConnection {
  private readonly options: CollabConnectionOptions;
  private socket: WebSocket | null = null;
  private wanted = false;
  private revoked = false;
  private attempt = 0;
  private retryTimer: number | undefined;

  constructor(options: CollabConnectionOptions) {
    this.options = options;
  }

  /** Start, or resume, connecting. Safe to call again. */
  connect(): void {
    if (this.wanted || this.revoked) return;
    this.wanted = true;
    void this.open();
  }

  /** Stop, for example when the tab is hidden or the device goes offline. */
  disconnect(): void {
    this.wanted = false;
    window.clearTimeout(this.retryTimer);
    this.drop();
    if (!this.revoked) this.options.onStatus('idle');
  }

  /** Drop the socket and open a fresh one at once. */
  restart(): void {
    this.drop();
    void this.open();
  }

  /** Something went wrong that reconnecting can fix: drop the socket and retry through the backoff. */
  fail(): void {
    if (!this.wanted) return;
    this.drop();
    this.retry();
  }

  /** The join worked: the next failure starts the backoff over. */
  joined(): void {
    this.attempt = 0;
  }

  /** The note was left: no more reconnecting, and the socket closes after the delay. */
  closeAfter(delayMs: number): void {
    this.wanted = false;
    window.clearTimeout(this.retryTimer);
    const socket = this.socket;
    if (socket) {
      window.setTimeout(() => {
        socket.close(1000);
      }, delayMs);
    }
  }

  send(frame: Uint8Array): boolean {
    const socket = this.socket;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(frame as Uint8Array<ArrayBuffer>);
    return true;
  }

  private async open(): Promise<void> {
    if (!this.wanted || this.socket) return;
    this.options.onStatus('connecting');
    try {
      const [ticket, lastSeq] = await Promise.all([
        this.options.requestTicket(this.options.noteId),
        collabStore.lastSeq(this.options.noteId),
      ]);
      if (!this.wanted || this.socket) return;
      this.options.onOpening(ticket.role, lastSeq);
      this.attach(this.options.createSocket(collabSocketUrl(ticket.ticket)), lastSeq);
    } catch (error) {
      if (isNotFound(error) || isForbidden(error)) this.revoke();
      else this.retry();
    }
  }

  private attach(socket: WebSocket, lastSeq: number): void {
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      socket.send(encodeJoin(lastSeq) as Uint8Array<ArrayBuffer>);
    };
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data instanceof ArrayBuffer) this.options.onFrame(new Uint8Array(event.data));
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.drop();
      if (event.code === CLOSE_CODE.ACCESS_REMOVED) this.revoke();
      else if (this.wanted) this.retry();
      else this.options.onStatus('idle');
    };
    this.socket = socket;
  }

  private drop(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close(1000);
    }
    this.options.onLost();
  }

  private retry(): void {
    this.options.onStatus('retrying');
    const delay = SYNC_BACKOFF_MS[Math.min(this.attempt, SYNC_BACKOFF_MS.length - 1)] ?? 0;
    this.attempt += 1;
    this.retryTimer = window.setTimeout(() => {
      void this.open();
    }, delay);
  }

  private revoke(): void {
    this.revoked = true;
    this.wanted = false;
    window.clearTimeout(this.retryTimer);
    this.drop();
    this.options.onStatus('revoked');
  }
}
