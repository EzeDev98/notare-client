/**
 * Runs once before every test file.
 *
 * The /vitest entry point registers jest-dom's matchers with Vitest's expect
 * AND augments its types, which is what makes toBeInTheDocument() both work
 * and typecheck. Importing '@testing-library/jest-dom' without the suffix
 * registers against Jest's global expect and silently does nothing here.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * Unmounts anything render() mounted, after every test.
 *
 * RTL does this automatically ONLY when Vitest runs with globals: true, by
 * detecting a global afterEach. We chose globals: false in 1F so that
 * describe/it/expect are imported explicitly — which means this hook has to be
 * registered by hand.
 *
 * Without it, every render in a file accumulates in the same document. Queries
 * then fail with "found multiple elements" — and worse, a test can pass by
 * matching an element a PREVIOUS test rendered, which is a false green that
 * survives deleting the code under test.
 */
afterEach(cleanup);
