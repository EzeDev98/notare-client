/**
 * Runs once before every test file.
 */
import '@testing-library/jest-dom/vitest';

/*
 * jsdom has no IndexedDB — it implements the DOM, not the whole platform. This
 * installs a spec-compliant implementation on the global, so the auth token
 * store can be tested for real rather than behind a mock of itself.
 *
 * Step 7 needs the same shim for the notes database.
 */
import 'fake-indexeddb/auto';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetDatabase } from './harness';
import { server } from './msw/server';

/*
 * onUnhandledRequest: 'error' is what makes the mock server trustworthy.
 *
 * The default lets an unmatched request through to the REAL network, so a
 * typo'd path quietly tries to reach a server that is not running and the test
 * fails with a confusing connection error. Failing loudly turns that into
 * "no handler for GET /api/v1/nots".
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

/*
 * Removes per-test overrides while keeping the defaults.
 *
 * Without this, a test that stubs a 500 leaves that 500 in place for every
 * test after it — order-dependent failures, which are the worst kind to debug
 * because the failing test is not the broken one.
 */
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/*
 * Unmounts anything render() mounted.
 *
 * RTL registers this automatically only when Vitest runs with globals: true.
 * We chose globals: false in 1F so describe/it/expect are imported explicitly,
 * which means registering by hand. Without it, renders accumulate in one
 * document — and a test can pass by matching an element a PREVIOUS test
 * rendered, a false green that survives deleting the code under test.
 */
afterEach(cleanup);

/*
 * Empties Dexie between tests.
 *
 * fake-indexeddb lives as long as the module, not the test. Since 7C the list
 * renders from the database rather than from a response, so a leaked row is
 * not a stale mock — it is a note appearing in a test that never created one,
 * and the resulting green is meaningless.
 */
afterEach(async () => {
  await resetDatabase();
});
