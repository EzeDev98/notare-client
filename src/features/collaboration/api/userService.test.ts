import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { userService } from '@/features/collaboration/api/userService';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

describe('searchUsers', () => {
  it('returns matching users for a real query', async () => {
    const page = await userService.searchUsers('ada');
    expect(page.content).toHaveLength(1);
  });

  it('does not special-case a blank query locally — server decides, returns empty', async () => {
    const page = await userService.searchUsers('');
    expect(page.content).toHaveLength(0);
  });

  it('sends the query under `q`, not `query` (that name is note search\'s)', async () => {
    let sentUrl = '';
    server.use(
      http.get(`${BASE}/user/search`, ({ request }) => {
        sentUrl = request.url;
        return HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        });
      }),
    );

    await userService.searchUsers('grace');
    expect(sentUrl).toContain('q=grace');
    expect(sentUrl).not.toContain('query=grace');
  });
});
