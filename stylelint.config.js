// Stylelint: the design rules as tooling (Guide step 3, A-09). No "extends":
// every rule is listed here, as in Ahorra's config.

// LEGACY CSS. Written before the design rules existed. Each file leaves this
// list when its screen is rebuilt (steps 6 to 14) and the list ends empty.
// Never add a file to it. New CSS must pass.
const LEGACY = [
  'src/app/layouts/AppLayout.css',
  'src/app/layouts/MobileNotesPanel.css',
  'src/app/layouts/SettingsPanel.css',
  'src/pages/Invitations/Invitations.css',
  'src/pages/InviteCollaborator/InviteCollaborator.css',
  'src/pages/Notes/Notes.css',
  'src/pages/NotesLanding/NotesLanding.css',
  'src/pages/Notifications/Notifications.css',
  'src/pages/Search/Search.css',
  'src/pages/Sessions/Sessions.css',
  'src/pages/ShareNote/ShareNote.css',
  'src/pages/ShareVoiceNote/ShareVoiceNote.css',
  'src/pages/SharedNote/SharedNote.css',
  'src/pages/SharedNotes/SharedNotes.css',
  'src/pages/Trash/Trash.css',
  'src/design-system/components/Button/Button.css',
  'src/design-system/components/Logo/Logo.css',
  'src/design-system/components/Modal/Modal.css',
  'src/design-system/components/ThemeToggle/ThemeToggle.css',
  'src/design-system/components/Toast/Toast.css',
  'src/features/collaboration/components/CollaboratorPicker/CollaboratorPicker.css',
  'src/features/editor/components/EditorSurface/EditorSurface.css',
  'src/features/notes/components/NoteCard/NoteCard.css',
  'src/features/notes/components/NoteContextMenu/NoteContextMenu.css',
  'src/features/notes/components/NoteTabs/NoteTabs.css',
  'src/features/notes/components/SidebarNoteItem/SidebarNoteItem.css',
  'src/features/notifications/components/NotificationsPanel/NotificationsPanel.css',
  'src/features/sharedNotes/components/SharedNoteCard/SharedNoteCard.css',
  'src/features/voice/components/InlineVoiceNote/InlineVoiceNote.css',
  'src/features/voice/components/VoiceNoteCard/VoiceNoteCard.css',
  'src/features/voice/components/VoiceRecorder/VoiceRecorder.css',
];

export default {
  ignoreFiles: LEGACY,
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
      // The layout components and the page base may centre and size a screen.
      files: ['src/design-system/components/layout/*.css', 'src/design-system/base.css'],
      rules: { 'declaration-property-value-disallowed-list': null },
    },
    {
      // Raw values live in these files and only here.
      files: [
        'src/design-system/tokens.css',
        'src/design-system/bridge.css',
        'src/design-system/legacy-aliases.css',
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
