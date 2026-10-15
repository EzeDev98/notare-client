// Stylelint: the design rules as tooling (Guide step 3, A-09). No "extends":
// every rule is listed here, as in Ahorra's config.

export default {
  rules: {
    // No raw colours: use a token.
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],

    // No raw pixel values: use a token. Media and container query widths are exempt.
    'unit-disallowed-list': [['px'], { ignoreMediaFeatureNames: { px: ['/.*/'] } }],

    // No !important anywhere.
    'declaration-no-important': true,

    // Only the design's values for decoration, weight and radius.
    'declaration-property-value-allowed-list': {
      '/^text-decoration(-line)?$/': ['none'],
      'font-weight': ['/^var\\(--font-weight\\)$/', 'inherit'],
      '/^border(-[a-z]+)*-radius$/': ['/^var\\(--radius(-sm)?\\)$/', '0', '50%', 'inherit'],
    },

    // Only the shared layout components position a screen vertically.
    'declaration-property-value-disallowed-list': {
      '/^margin-(top|bottom|block|block-start|block-end)$/': ['/auto/'],
      '/^(min-)?height$/': ['/^100d?vh$/'],
    },
  },
  overrides: [
    {
      // The layout components, the page base and the app shell may centre and size a screen.
      files: ['src/design-system/components/layout/*.css', 'src/design-system/base.css', 'src/app/shell/*.css'],
      rules: { 'declaration-property-value-disallowed-list': null },
    },
    {
      // Raw values live in these files and only here.
      files: [
        'src/design-system/tokens.css',
        'src/design-system/bridge.css',
      ],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
        'unit-disallowed-list': null,
        'declaration-property-value-allowed-list': null,
      },
    },
    {
      // @font-face must declare the real weight.
      files: ['src/design-system/fonts.css'],
      rules: { 'declaration-property-value-allowed-list': null },
    },
    {
      // Kept on purpose (D-007): the global reset and the icon size rule.
      files: ['src/design-system/tokens/reset.css', 'src/design-system/tokens/icons.css'],
      rules: {
        'declaration-no-important': null,
        'unit-disallowed-list': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
  ],
};
