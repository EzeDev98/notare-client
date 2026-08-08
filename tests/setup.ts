/**
 * Runs once before every test file.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

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
