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

// Route strings (7a, S-12). Only src/app/routes.ts may spell a screen path.
// \x2f is a slash: ESLint selectors cannot hold a literal slash inside a regex.
const ROUTE_RE =
  '^\\x2f(notes|settings|sign-in|register|verify|reset|install|welcome|login|reset-password|archived|trash|search|shared|shared-voice|voice|collaborations|notifications|account)(\\x2f|\\?|$)';
const ROUTE_STRING = {
  selector: `Literal[value=/${ROUTE_RE}/], TemplateElement[value.raw=/${ROUTE_RE}/]`,
  message: 'No path strings outside src/app/routes.ts. Use ROUTES from @/app/routes.',
};

// PatternFly stays inside the design-system ui/ folder.
const PATTERNFLY_PATTERNS = [
  {
    group: ['@patternfly/react-icons', '@patternfly/react-icons/**'],
    message: 'Icons are Lucide only (A-10). Import from lucide-react.',
  },
  {
    group: ['@patternfly/*', '@patternfly/**'],
    message: 'PatternFly is wrapped. Import from @/design-system, never @patternfly/* directly.',
  },
];

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
        projectService: { allowDefaultProject: ['vite-plugins/*.ts'] },
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
      // Test helpers export components and functions together; there is no Fast Refresh in tests.
      'react-refresh/only-export-components': 'off',
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
              /*
               * The CLIENT is forbidden, not the whole module.
               *
               * @/lib/http/errors exports type guards over error VALUES —
               * isConflict, isUnauthorized, fieldErrors. A page catching an
               * error and asking "was that a 401?" is precisely what §11 asks
               * for, and banning it would force every page into either a
               * generic catch or a pointless re-export of the same predicates
               * through a feature module.
               *
               * What must stay out of a component is the ability to MAKE a
               * request or touch the database.
               */
              group: ['@/lib/http/client', '@/lib/http/authHooks', '@/lib/db', '@/lib/db/**'],
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

  // ==========================================================================
  // DESIGN SYSTEM RULES (3C, 3D) — see docs/decisions.md.
  //
  // Flat config REPLACES a rule's options when a later block matches the same
  // file, it does not merge them. So each rule below appears in as few blocks
  // as possible, and no-restricted-syntax lists every selector a file needs.
  // ==========================================================================

  // PatternFly and react-icons: only the design-system ui/ folder may touch PF.
  // Uses the typescript-eslint version so it does not clash with the layer
  // rules above, which use the core no-restricted-imports.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/design-system/ui/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...PATTERNFLY_PATTERNS,
            {
              group: ['**/api/noteService', '**/api/voiceService', '**/api/sharedNoteService'],
              message: 'Talk to the note server through `gateway` from @/core/adapter (step 7f).',
            },
          ],
        },
      ],
    },
  },

  // The adapter is the one place that may import those services. Tests may too.
  {
    files: ['src/core/adapter/**/*.ts', '**/*.test.{ts,tsx}'],
    ignores: ['src/design-system/ui/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: PATTERNFLY_PATTERNS }],
    },
  },

  // No raw <button> outside the design-system ui/ folder.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/design-system/ui/**', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Use <Button> or <IconButton> from @/design-system. Raw <button> lives in design-system/ui only.',
        },
        ROUTE_STRING,
      ],
    },
  },

  // Same ban, plus: no timers in features and pages. Timings go through the
  // motion module (step 4) and the config file (step 7).
  {
    files: ['src/features/**/*.tsx', 'src/pages/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Use <Button> or <IconButton> from @/design-system. Raw <button> lives in design-system/ui only.',
        },
        {
          selector:
            "CallExpression[callee.name=/^(setTimeout|requestAnimationFrame)$/], CallExpression[callee.object.name='window'][callee.property.name=/^(setTimeout|requestAnimationFrame)$/]",
          message: 'No setTimeout or requestAnimationFrame in features or pages. Use the motion module and the timing config.',
        },
        ROUTE_STRING,
      ],
    },
  },

  // Route strings in .ts files (hooks, helpers). api/, lib/, sync/, pwa/ and the local
  // database layer talk to the server or storage, not the router, so they keep their paths.
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/app/routes.ts',
      'src/**/api/**',
      'src/lib/**',
      'src/sync/**',
      'src/pwa/**',
      'src/features/*/local/**',
      '**/*.test.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', ROUTE_STRING],
    },
  },

  // File size (3D). Files over the limit carry a disable comment with a
  // TODO(step N); the rest of the legacy ones are in eslint-suppressions.json.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 210, skipBlankLines: true, skipComments: true }],
    },
  },

  /*
   * LAST. Turns off every ESLint rule that Prettier owns. Without it, a
   * formatted file fails lint and a linted file gets reformatted, forever.
   */
  prettier,
);
