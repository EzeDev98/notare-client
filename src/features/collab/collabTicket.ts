import type { CollabRole } from '@/features/collab/collabProtocol';
import { env } from '@/lib/config/env';
import { httpClient } from '@/lib/http/client';

export interface CollabTicket {
  ticket: string;
  role: CollabRole;
}

const isRole = (value: string): value is CollabRole => value === 'owner' || value === 'editor' || value === 'viewer';

/**
 * A one-time ticket to open the socket for a note (valid 60 seconds, used once). Ask for a new one
 * on every reconnect. A 404 means the note is gone or no longer shared with this person.
 * An unknown role reads as viewer: the safe side.
 */
export async function requestCollabTicket(noteId: number): Promise<CollabTicket> {
  const response = await httpClient.post<{ ticket: string; role: string }>(
    `/notes/${String(noteId)}/collab-ticket`,
    {},
  );
  return { ticket: response.ticket, role: isRole(response.role) ? response.role : 'viewer' };
}

/** wss://<host>/api/v1/ws/collab?ticket=..., from the same base address as every other request. */
export function collabSocketUrl(ticket: string): string {
  const url = new URL(`${env.apiBaseUrl}/ws/collab`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  return url.toString();
}
