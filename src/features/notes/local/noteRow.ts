/** A note as stored on the device. */
import type { ServerDateTime } from '@/lib/http/types';

export interface NoteRow {
  localId: string;

  serverId: number | null;

  clientId: string;

  content: string;
  pinned: 0 | 1;
  deleted: 0 | 1;

  version: number | null;

  createdAt: ServerDateTime | null;
  updatedAt: ServerDateTime | null;
  deletedAt: ServerDateTime | null;

  ownerId: number | null;
  lastModifiedBy: number | null;

  dirty: 0 | 1;

  syncState: 'synced' | 'pending' | 'invalid';

  localUpdatedAt: number;

  bodyState?: Uint8Array | null;

  bodySeedVersion?: number;

  restorable?: boolean;

  aiTitle?: string | null;
}
