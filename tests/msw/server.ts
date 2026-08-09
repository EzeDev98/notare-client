import { setupServer } from 'msw/node';

import { authHandlers } from './authHandlers';
import { handlers } from './handlers';

/**
 * The mock server, shared by every test file.
 *
 * MSW intercepts at the NETWORK layer rather than replacing fetch with a spy,
 * so code under test calls the real fetch and gets a real Response — which is
 * why abort handling, streaming bodies and header normalisation behave
 * correctly for free.
 */
export const server = setupServer(...authHandlers, ...handlers);
