/**
 * The collaboration wire format (step 16a, D-032). It mirrors the server's
 * docs/collab-protocol.md and CollabProtocol.java exactly: change them together.
 *
 * Every frame is binary. Byte 0 is the type. Numbers are big-endian. A frame is at
 * most 1,048,576 bytes including the type byte. The server never reads Yjs bytes.
 *
 * Client to server:
 *   JOIN      01 | lastSeq (8)                          e.g. lastSeq 5: 01 00 00 00 00 00 00 00 05
 *   UPDATE    02 | Yjs update bytes
 *   SNAPSHOT  03 | upToSeq (8) | stateLength (4) | state | plain text (UTF-8, to the end)
 *   AWARENESS 04 | opaque presence bytes
 *
 * Server to client:
 *   UPDATE    02 | seq (8) | Yjs update bytes
 *   SNAPSHOT  03 | upToSeq (8) | Yjs state
 *   AWARENESS 04 | opaque presence bytes, relayed unchanged
 *   ROLE      05 | 0 owner, 1 editor, 2 viewer
 *   ACK       06 | seq (8): the seq given to your UPDATE
 *   SYNCED    07 | head (8): the last seq on the server
 *   ERROR     08 | code (1)
 */

export const FRAME = {
  JOIN: 1,
  UPDATE: 2,
  SNAPSHOT: 3,
  AWARENESS: 4,
  ROLE: 5,
  ACK: 6,
  SYNCED: 7,
  ERROR: 8,
} as const;

/** Largest frame the server accepts, type byte included. Past it the server closes with 1009. */
export const MAX_FRAME_BYTES = 1_048_576;

/** Codes in an ERROR frame. The socket stays open after one. */
export const ERROR_CODE = {
  READ_ONLY: 1,
  NOT_JOINED: 2,
  ALREADY_JOINED: 3,
  BAD_SNAPSHOT: 4,
  SERVER: 5,
} as const;

/** Close codes the server uses. 4403 means access was removed: do not reconnect. */
export const CLOSE_CODE = {
  TOO_BIG: 1009,
  BAD_FRAME: 4400,
  ACCESS_REMOVED: 4403,
  RATE_LIMIT: 4429,
} as const;

export type CollabRole = 'owner' | 'editor' | 'viewer';

/** Index is the wire value of the ROLE frame. */
const ROLE_BY_BYTE: readonly CollabRole[] = ['owner', 'editor', 'viewer'];

export type CollabFrameErrorReason = 'empty' | 'unknown-type' | 'bad-length' | 'bad-value' | 'too-large';

/** A frame that cannot be built or read. The provider logs it and carries on, or skips the send. */
export class CollabFrameError extends Error {
  readonly reason: CollabFrameErrorReason;

  constructor(reason: CollabFrameErrorReason, message: string) {
    super(message);
    this.name = 'CollabFrameError';
    this.reason = reason;
  }
}

/** A frame the server sends, read into its parts. */
export type ServerFrame =
  | { type: 'update'; seq: number; update: Uint8Array }
  | { type: 'snapshot'; upToSeq: number; state: Uint8Array }
  | { type: 'awareness'; payload: Uint8Array }
  | { type: 'role'; role: CollabRole }
  | { type: 'ack'; seq: number }
  | { type: 'synced'; head: number }
  | { type: 'error'; code: number };

const TYPE_BYTES = 1;
const SEQ_BYTES = 8;
const LENGTH_BYTES = 4;
const ROLE_FRAME_BYTES = TYPE_BYTES + 1;
const ERROR_FRAME_BYTES = TYPE_BYTES + 1;
const SEQ_FRAME_BYTES = TYPE_BYTES + SEQ_BYTES;

const encoder = new TextEncoder();

// ---- Building frames ---------------------------------------------------------

function frameOf(type: number, bodyBytes: number): { frame: Uint8Array; view: DataView } {
  const size = TYPE_BYTES + bodyBytes;
  if (size > MAX_FRAME_BYTES) {
    throw new CollabFrameError('too-large', `A frame of ${String(size)} bytes is over the ${String(MAX_FRAME_BYTES)} limit`);
  }
  const frame = new Uint8Array(size);
  frame[0] = type;
  return { frame, view: new DataView(frame.buffer) };
}

function writeSeq(view: DataView, offset: number, seq: number): void {
  if (!Number.isSafeInteger(seq) || seq < 0) {
    throw new CollabFrameError('bad-value', `Not a valid seq: ${String(seq)}`);
  }
  view.setBigUint64(offset, BigInt(seq));
}

/** JOIN: the last seq this device holds for the note, 0 for none. Send it first, then wait for SYNCED. */
export function encodeJoin(lastSeq: number): Uint8Array {
  const { frame, view } = frameOf(FRAME.JOIN, SEQ_BYTES);
  writeSeq(view, TYPE_BYTES, lastSeq);
  return frame;
}

/** UPDATE: one Yjs update. The server closes the socket on an empty one, so it is refused here. */
export function encodeUpdate(update: Uint8Array): Uint8Array {
  if (update.length === 0) throw new CollabFrameError('bad-value', 'An update cannot be empty');
  const { frame } = frameOf(FRAME.UPDATE, update.length);
  frame.set(update, TYPE_BYTES);
  return frame;
}

/** SNAPSHOT: the Yjs state with every update up to upToSeq, and the note's plain text. */
export function encodeSnapshot(snapshot: { upToSeq: number; state: Uint8Array; plainText: string }): Uint8Array {
  const { upToSeq, state, plainText } = snapshot;
  if (upToSeq < 1 || state.length === 0) {
    throw new CollabFrameError('bad-value', 'A snapshot needs a seq of at least 1 and a non-empty state');
  }
  const text = encoder.encode(plainText);
  const { frame, view } = frameOf(FRAME.SNAPSHOT, SEQ_BYTES + LENGTH_BYTES + state.length + text.length);
  writeSeq(view, TYPE_BYTES, upToSeq);
  view.setUint32(TYPE_BYTES + SEQ_BYTES, state.length);
  const stateStart = TYPE_BYTES + SEQ_BYTES + LENGTH_BYTES;
  frame.set(state, stateStart);
  frame.set(text, stateStart + state.length);
  return frame;
}

/** AWARENESS: the presence bytes from y-protocols, sent as they are. */
export function encodeAwareness(payload: Uint8Array): Uint8Array {
  const { frame } = frameOf(FRAME.AWARENESS, payload.length);
  frame.set(payload, TYPE_BYTES);
  return frame;
}

// ---- Reading frames ----------------------------------------------------------

function readSeq(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CollabFrameError('bad-value', 'A seq is too large to hold');
  }
  return Number(value);
}

function need(data: Uint8Array, bytes: number, exactly = false): void {
  if (exactly ? data.length !== bytes : data.length < bytes) {
    throw new CollabFrameError('bad-length', `Frame type ${String(data[0])} has ${String(data.length)} bytes, expected ${exactly ? '' : 'at least '}${String(bytes)}`);
  }
}

/**
 * Reads one frame from the server. Throws CollabFrameError for an empty, unknown or
 * malformed frame; the server never sends one, so the provider only logs it.
 * The returned byte arrays are views into `data`: copy them to keep them.
 */
export function decodeServerFrame(data: Uint8Array): ServerFrame {
  if (data.length === 0) throw new CollabFrameError('empty', 'An empty frame');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  switch (view.getUint8(0)) {
    case FRAME.UPDATE:
      need(data, SEQ_FRAME_BYTES);
      return { type: 'update', seq: readSeq(view, TYPE_BYTES), update: data.subarray(SEQ_FRAME_BYTES) };
    case FRAME.SNAPSHOT:
      need(data, SEQ_FRAME_BYTES);
      return { type: 'snapshot', upToSeq: readSeq(view, TYPE_BYTES), state: data.subarray(SEQ_FRAME_BYTES) };
    case FRAME.AWARENESS:
      return { type: 'awareness', payload: data.subarray(TYPE_BYTES) };
    case FRAME.ROLE: {
      need(data, ROLE_FRAME_BYTES, true);
      const role = ROLE_BY_BYTE[view.getUint8(TYPE_BYTES)];
      if (role === undefined) throw new CollabFrameError('bad-value', 'An unknown role');
      return { type: 'role', role };
    }
    case FRAME.ACK:
      need(data, SEQ_FRAME_BYTES, true);
      return { type: 'ack', seq: readSeq(view, TYPE_BYTES) };
    case FRAME.SYNCED:
      need(data, SEQ_FRAME_BYTES, true);
      return { type: 'synced', head: readSeq(view, TYPE_BYTES) };
    case FRAME.ERROR:
      need(data, ERROR_FRAME_BYTES, true);
      return { type: 'error', code: view.getUint8(TYPE_BYTES) };
    default:
      throw new CollabFrameError('unknown-type', `Unknown frame type ${String(data[0])}`);
  }
}
