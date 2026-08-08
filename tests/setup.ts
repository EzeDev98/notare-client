/**
 * Runs once before every test file.
 *
 * The /vitest entry point registers jest-dom's matchers with Vitest's expect
 * AND augments its types, which is what makes toBeInTheDocument() both work
 * and typecheck. Importing '@testing-library/jest-dom' without the suffix
 * registers against Jest's global expect and silently does nothing here.
 */
import '@testing-library/jest-dom/vitest';
