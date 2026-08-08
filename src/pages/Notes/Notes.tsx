import { useTheme } from '@/app/providers/ThemeProvider';

/** TEMPORARY specimen. Replaced by the real note list in Step 5B. */
export function NotesPage() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <article
      style={{
        maxWidth: 'var(--measure-prose)',
        margin: '0 auto',
        padding: 'var(--space-8) var(--space-4)',
      }}
    >
      <h1>Notare</h1>

      <p style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {(['light', 'dark', 'system'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setPreference(option);
            }}
            aria-pressed={preference === option}
            style={{
              background: preference === option ? 'var(--color-accent)' : 'var(--color-surface)',
              color: preference === option ? 'var(--color-text-on-accent)' : 'var(--color-text)',
              border: 'var(--border-width) solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            {option}
          </button>
        ))}
        <small style={{ color: 'var(--color-text-secondary)' }}>showing: {resolved}</small>
      </p>

      <p
        style={{
          fontSize: 'var(--font-size-md)',
          lineHeight: 'var(--line-height-relaxed)',
        }}
      >
        Note content at the reading size. The page background is warm; the surface below is white.
        That difference should be barely perceptible and still present — layering from contrast
        rather than shadow.
      </p>

      <p style={{ color: 'var(--color-text-secondary)' }}>
        Secondary text, for metadata a user actually reads. 4.59:1.
      </p>

      <p style={{ color: 'var(--color-text-disabled)' }}>
        Disabled text at 2.41:1. If this looks readable to you, that is the problem — it is here to
        be visibly unavailable.
      </p>

      <div
        style={{
          background: 'var(--color-surface)',
          border: 'var(--border-width) solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          boxShadow: 'var(--shadow-sm)',
          marginBlock: 'var(--space-6)',
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-text-on-accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
          }}
        >
          Primary action
        </button>

        <input
          aria-label="Control boundary check"
          placeholder="Border at 3.44:1"
          style={{
            border: 'var(--border-width) solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
          }}
        />

        <span
          style={{
            background: 'var(--color-accent-subtle)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Selected
        </span>

        <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
          ⚠ Error — never colour alone
        </span>
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        Tab through this page. Every focusable element should show a lavender ring with a visible
        gap around it.
      </p>
    </article>
  );
}
