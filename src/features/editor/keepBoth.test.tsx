import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
import { makeNote, makeRow } from '~/fixtures/notes';
import { noteConflict } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/**
 * Conflict RESOLUTION, tested against the hook rather than the page.
 *
 * No router, no auth provider, no editor surface — the logic under test is
 * "given a conflict and a draft, what does each option produce", and none of
 * that scaffolding participates in the answer. The page-level version of this
 * test spent most of its life failing on its own harness.
 */
describe('keepBoth', () => {
  it('merges both versions, losing nobody’s words', async () => {
    server.use(
      http.get(`${BASE}/notes/:noteId`, () =>
        HttpResponse.json(makeNote({ id: 1, content: 'their words', version: 7 })),
      ),
      http.patch(`${BASE}/notes/:noteId`, () => noteConflict(7)),
    );

    const { result } = renderHook(() =>
      useNoteEditor(makeRow({ serverId: 1, content: 'original', version: 0 })),
    );

    act(() => {
      result.current.setDraft({ content: 'my words' });
      result.current.markEdited();
    });

    // Provoke the conflict directly rather than waiting out the debounce.
    await act(async () => {
      await result.current.save().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.saveState.status).toBe('conflict');
    });
    await waitFor(() => {
      expect(result.current.conflict.status).toBe('ready');
    });

    act(() => {
      result.current.keepBoth();
    });

    /*
     * The only option that destroys nothing. "Keep mine" loses their words,
     * "use theirs" loses mine — and a person interrupted mid-sentence clicks
     * the emphasised button, so it had better be the safe one.
     */
    // The draft lives in the row now (7C), not in hook state.
    const merged = result.current.row.content;
    expect(merged).toContain('their words');
    expect(merged).toContain('my words');
    // Mine first, then theirs.
    expect(merged.indexOf('my words')).toBeLessThan(merged.indexOf('their words'));

    // The server's version is adopted, so the follow-up save is accepted
    // rather than rejected as stale.
    expect(result.current.row.version).toBe(7);
  });
});
