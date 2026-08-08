import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * Flat config is ORDER-DEPENDENT: later entries override earlier ones. That is
 * why prettier is last and why the architectural rules sit after the general
 * ones rather than before.
 *
 * Two halves:
 *   1. Code quality — added here in 1F, chosen one plugin at a time.
 *   2. Architectural boundaries — added in 1C, unchanged. See
 *      docs/architecture/structure.md.
 */

const NEVER_UPWARD = 'Imports must point down the layer stack. See docs/architecture/structure.md.';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,

  /*
   * TYPE-AWARE linting. recommendedTypeChecked resolves the TypeScript program
   * rather than reading files in isolation, which is what makes
   * no-floating-promises possible — knowing an expression is a Promise means
   * knowing its type.
   *
   * It costs roughly 3x the lint time. Worth it for a codebase whose hardest
   * bugs are all asynchronous: a forgotten `await` on a token refresh or an
   * auto-save produces no error, no visible rejection, and a race that appears
   * once a week.
   */
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // Finds the right tsconfig per file automatically, so src/ and
        // vite.config.ts each get linted against their own settings.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      /*
       * The two rules this whole type-aware setup exists for.
       *
       * no-floating-promises: an un-awaited async call compiles, runs, and
       * looks fine. If it rejects you get an unhandled rejection with no stack
       * pointing anywhere useful. Requiring await / .catch() / explicit `void`
       * forces the "what if this fails?" question while the answer is still
       * obvious.
       *
       * no-misused-promises: catches `onClick={async () => ...}` where the
       * handler's rejection is swallowed, and `if (somePromise)` — which is
       * always true.
       */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // `_next` for a deliberately unused parameter is a real convention, not
      // an oversight. tsconfig's noUnusedParameters covers the rest.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /*
       * rules-of-hooks is ERROR: a conditional hook call corrupts React's
       * internal state and the resulting bug is nowhere near the cause.
       *
       * exhaustive-deps is WARN, deliberately. It is usually right and
       * occasionally wrong, and a rule that is wrong 5% of the time as an
       * error teaches you to disable it — at which point it is wrong 100% of
       * the time. Treat each warning as a question to answer, not noise.
       */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Fast Refresh only preserves state when a module exports components
      // and nothing else; mixed exports silently full-reload instead.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  /*
   * Test files. Non-null assertions are acceptable in a test — a bad assertion
   * fails the test loudly, which is the point of the file.
   */
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  /*
   * This config file and any other plain JS: no TypeScript program to resolve,
   * so type-aware rules would error rather than lint.
   */
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked],
  },

  // ==========================================================================
  // ARCHITECTURAL BOUNDARIES (1C) — the dependency DIRECTION between layers.
  //
  //     pages / feature components
  //              |  (hooks only)
  //     feature hooks + state
  //              |
  //     feature api (domain services)
  //              |
  //     lib (http, db)  <->  sync
  //
  // Downward imports are fine. Upward ones are the error.
  // ==========================================================================

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*'],
              message:
                'Use the @/ alias for imports that leave your directory — a deep relative path hides which layer it crosses.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app',
                '@/app/**',
                '@/pages',
                '@/pages/**',
                '@/features',
                '@/features/**',
                '@/design-system',
                '@/design-system/**',
                '@/sync',
                '@/sync/**',
              ],
              message: `lib/ is infrastructure and must not know the application exists. ${NEVER_UPWARD}`,
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/design-system/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app',
                '@/app/**',
                '@/pages',
                '@/pages/**',
                '@/features',
                '@/features/**',
                '@/sync',
                '@/sync/**',
                '@/lib',
                '@/lib/**',
              ],
              message: `design-system/ is presentation only — no data access, no feature types. ${NEVER_UPWARD}`,
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/sync/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app',
                '@/app/**',
                '@/pages',
                '@/pages/**',
                '@/design-system',
                '@/design-system/**',
                '@/features/*/components/**',
              ],
              message: `sync/ has no UI. Expose state for React to subscribe to instead. ${NEVER_UPWARD}`,
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/pages/**/*.{ts,tsx}', 'src/features/*/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/http', '@/lib/http/**', '@/lib/db', '@/lib/db/**'],
              message:
                'Components must not speak HTTP or touch the database. Use a hook from the relevant feature.',
            },
            {
              group: ['@/features/*/api/**'],
              message:
                'Components must not call domain services directly. Use the feature hook that wraps it.',
            },
            {
              group: ['@/sync', '@/sync/**'],
              message:
                'Components must not drive the sync engine. Subscribe to its status through a hook.',
            },
          ],
        },
      ],
    },
  },

  /*
   * LAST. Turns off every ESLint rule that Prettier owns. Without it, a
   * formatted file fails lint and a linted file gets reformatted, forever.
   */
  prettier,
);
