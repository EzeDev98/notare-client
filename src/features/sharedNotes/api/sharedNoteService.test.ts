import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

let lastRequest: Request | undefined;

beforeEach(() => {
  lastRequest = undefined;
  server.events.on('request:start', ({ request }) => {
    lastRequest = request;
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe('listSharedNotes', () => {
  it('lists notes shared with the current user, zero-based', async () => {
    const page = await sharedNoteService.listSharedNotes({ page: 0, size: 20 });

    expect(page.content).toHaveLength(1);
    expect(page.page).toBe(0);
    expect(lastRequest?.url).toContain(`${BASE}/shared-notes?`);
  });

  it('returns the flat, recipient-shaped row', async () => {
    const page = await sharedNoteService.listSharedNotes();

    expect(page.content[0]?.noteId).toBeDefined();
    expect(page.content[0]?.role).toBe('VIEWER');
    expect(page.content[0]?.ownerName).toBe('Jane Doe');
  });
});
