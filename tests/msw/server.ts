import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * The mock server, shared by every test file.
 *
 * MSW intercepts at the NETWORK layer rather than replacing fetch with a spy,
 * so code under test calls the real fetch and gets a real Response. That is
 * why abort handling, streaming bodies and header normalisation all behave
 * correctly for free — 3D lost an hour to a hand-written stub that modelled
 * fetch incompletely, and this is the class of bug that removes.
 */
export const server = setupServer(...handlers);
