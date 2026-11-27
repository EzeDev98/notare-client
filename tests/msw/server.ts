/** The mock API server shared by every test. */
import { setupServer } from 'msw/node';

import { authHandlers } from './authHandlers';
import { handlers } from './handlers';

export const server = setupServer(...authHandlers, ...handlers);
