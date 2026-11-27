/** ESLint rules, including the import boundaries between app layers. */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

const NEVER_UPWARD = 'Imports must point down the layer stack. See docs/architecture/structure.md.';

const ROUTE_RE =
  '^\\x2f(notes|settings|sign-in|register|verify|reset|install|welcome|login|reset-password|archived|trash|search|voice|notifications|account)(\\x2f|\\?|$)';
const ROUTE_STRING = {
  selector: `Literal[value=/${ROUTE_RE}/], TemplateElement[value.raw=/${ROUTE_RE}/]`,
  message: 'No path strings outside src/app/routes.ts. Use ROUTES from @/app/routes.',
};

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

  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },

  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: { allowDefaultProject: ['vite-plugins/*.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    files: ['service-worker/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, __NOTARE_PRECACHE__: 'readonly' } },
  },

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
              group: ['**/api/noteService', '**/api/voiceService'],
              message: 'Talk to the note server through `api` from @/core/api.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/core/api/**/*.ts', 'src/core/adapter/**/*.ts', '**/*.test.{ts,tsx}'],
    ignores: ['src/design-system/ui/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: PATTERNFLY_PATTERNS }],
    },
  },

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

  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 210, skipBlankLines: true, skipComments: true }],
    },
  },

  prettier,
);
