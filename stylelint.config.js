/** Stylelint rules that enforce the design tokens in CSS. */
export default {
  rules: {
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],

    'unit-disallowed-list': [['px'], { ignoreMediaFeatureNames: { px: ['/.*/'] } }],

    'declaration-no-important': true,

    'declaration-property-value-allowed-list': {
      '/^text-decoration(-line)?$/': ['none'],
      'font-weight': ['/^var\\(--font-weight\\)$/', 'inherit'],
      '/^border(-[a-z]+)*-radius$/': ['/^var\\(--radius(-sm)?\\)$/', '0', '50%', 'inherit'],
    },

    'declaration-property-value-disallowed-list': {
      '/^margin-(top|bottom|block|block-start|block-end)$/': ['/auto/'],
      '/^(min-)?height$/': ['/^100d?vh$/'],
    },
  },
  overrides: [
    {
      files: ['src/design-system/components/layout/*.css', 'src/design-system/base.css', 'src/app/shell/*.css'],
      rules: { 'declaration-property-value-disallowed-list': null },
    },
    {
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
      files: ['src/design-system/fonts.css'],
      rules: { 'declaration-property-value-allowed-list': null },
    },
    {
      files: ['src/design-system/tokens/reset.css', 'src/design-system/tokens/icons.css'],
      rules: {
        'declaration-no-important': null,
        'unit-disallowed-list': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
  ],
};
