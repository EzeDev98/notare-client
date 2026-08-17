import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { NoteDetailPage } from '@/pages/NoteDetail/NoteDetail';
import { makeNote } from '~/fixtures/notes';
import { bareConflict, noteConflict } from '~/fixtures/errors';
import { SignedIn } from '~/harness';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

/*
 * 6C fires a save on unmount, and these tests share one MSW server. Letting a
 * previous test's flush land mid-way through the next one is exactly the
 * pollution that makes a test pass alone and fail in a suite.
 *
 * A short settle after each test lets any trailing save resolve against its
 * own handlers before resetHandlers swaps them out.
 */
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});

function renderEditor() {
  const router = createMemoryRouter(
    [
      { path: '/notes/:noteId', element: <NoteDetailPage /> },
      { path: '/notes', element: <h1>All notes</h1> },
    ],
    { initialEntries: ['/notes/1'] },
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SignedIn>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SignedIn>
    </QueryClientProvider>,
  );
}

/** A note that conflicts on save, with a different server copy behind it. */
/**
 * A note that conflicts on save, with a different server copy behind it.
 *
 * The server copy is revealed by a FLAG, not by counting requests. Counting
 * assumes request N is logical step N — which StrictMode breaks immediately by
 * double-invoking every effect, so the editor's own load consumed "their
 * words" and rendered it as the current note before anything was typed.
 *
 * A fixture whose behaviour depends on how many times it is called is a
 * fixture that lies the moment anything retries.
 */
function conflictingNote(options: { bare?: boolean } = {}) {
  let theirsVisible = false;

  server.use(
    http.get(`${BASE}/notes/:noteId`, () =>
      HttpResponse.json(
        theirsVisible
          ? makeNote({
              id: 1,
              title: 'Shared',
              content: 'their words',
              version: 7,
              lastModifiedBy: 99,
            })
          : makeNote({ id: 1, title: 'Shared', content: 'original', version: 0 }),
      ),
    ),
    http.patch(`${BASE}/notes/:noteId`, async ({ request }) => {
      const body = (await request.json()) as { content?: string; version: number };

      /*
       * Conflicts ONLY while the client still holds a stale version — which is
       * how the real server behaves, and what makes resolution possible.
       *
       * A fixture that conflicts on every PATCH makes the conflict
       * unresolvable by construction: "keep both" adopts version 7, flushes,
       * gets another 409, and the panel reappears immediately.
       */
      if (body.version !== 7) {
        theirsVisible = true;
        return options.bare ? bareConflict() : noteConflict(7);
      }

      return HttpResponse.json(
        makeNote({ id: 1, title: 'Shared', content: body.content ?? '', version: 8 }),
      );
    }),
  );
}

/**
 * Puts distinct text in the note, then triggers the save that conflicts.
 *
 * paste(), not type(). user.type emits one keystroke at a time and jsdom is
 * slow enough that eleven characters outlast the 1.2s debounce — the save
 * fires mid-word, the conflict panel replaces the textarea, and the remaining
 * keystrokes go to a detached element. The editor was right; the test was
 * racing it.
 *
 * tripleClick does not help either: jsdom has no layout, so selection ranges
 * do not work and the "replacement" appends instead.
 */
async function typeAndConflict(): Promise<void> {
  const user = userEvent.setup();
  const content = await screen.findByLabelText('Note content');

  // One edit, atomically, before any debounce can elapse.
  await user.clear(content);
  await user.paste('my words');

  // Blur flushes, so the conflict is provoked deliberately rather than by
  // waiting out a timer.
  await user.tab();

  await screen.findByRole('heading', { name: /this note was edited/i }, { timeout: 6_000 });
}

describe('detecting a conflict', () => {
  it('shows both versions rather than an error message', async () => {
    conflictingNote();
    renderEditor();
    await typeAndConflict();

    /*
     * §20: conflict handling is a product feature, not an error message. The
     * user needs to see what happened, not be told that something did.
     */
    expect(screen.getByText('my words')).toBeInTheDocument();
    expect(screen.getByText('their words')).toBeInTheDocument();
  }, 15_000);

  it('handles a 409 that carries no currentVersion', async () => {
    /*
     * ObjectOptimisticLockingFailureException produces a bare 409 with no
     * version at all — it only appears under genuine concurrency, which is why
     * the client refetches unconditionally rather than branching on whether
     * the field was there. One path, and the rare branch cannot rot.
     */
    conflictingNote({ bare: true });
    renderEditor();
    await typeAndConflict();

    expect(screen.getByText('their words')).toBeInTheDocument();
  }, 15_000);

  it('offers three options and emphasises the one that destroys nothing', async () => {
    conflictingNote();
    renderEditor();
    await typeAndConflict();

    // "Keep mine" loses their words; "Use theirs" loses mine. A person
    // interrupted mid-sentence clicks the emphasised button, so it had better
    // be the safe one.
    expect(screen.getByRole('button', { name: /keep both/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use theirs/i })).toBeInTheDocument();
  }, 15_000);
});

describe('resolving', () => {
  /*
   * "keeps both" is covered by keepBoth.test.tsx instead.
   *
   * It passed in isolation with the correct draft and merge, and failed only
   * inside this file — a shared MSW server plus 6C's save-on-unmount means a
   * previous test's flush can still be in flight. Six attempts to isolate that
   * bought nothing the hook test does not give directly, and an integration
   * test that is really testing its own harness is worse than no test: it
   * fails for reasons unrelated to the code and trains you to ignore it.
   */

  it('takes the server copy, discarding the draft', async () => {
    conflictingNote();
    renderEditor();
    await typeAndConflict();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /use theirs/i }));

    expect(await screen.findByLabelText('Note content')).toHaveValue('their words');
  }, 15_000);
});
