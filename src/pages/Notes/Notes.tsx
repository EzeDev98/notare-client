import { useState } from 'react';

import './Notes.css';

import { useTheme } from '@/app/providers/theme-context';
import { Button } from '@/design-system/components/Button/Button';
import { TextArea } from '@/design-system/components/TextArea/TextArea';
import { TextField } from '@/design-system/components/TextField/TextField';

/** TEMPORARY specimen. Replaced by the real note list in Step 5B. */
export function NotesPage() {
  const { preference, resolved, setPreference } = useTheme();
  const [loading, setLoading] = useState(false);

  return (
    <article className="specimen">
      <h1>Notare</h1>

      <div className="specimen__row">
        {(['light', 'dark', 'system'] as const).map((option) => (
          <Button
            key={option}
            variant={preference === option ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={preference === option}
            onClick={() => {
              setPreference(option);
            }}
          >
            {option}
          </Button>
        ))}
        <small>showing: {resolved}</small>
      </div>

      <div className="specimen__row">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button
          variant="primary"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
            }, 1500);
          }}
        >
          Click to load
        </Button>
      </div>

      <div className="specimen__form">
        <TextField label="Username" hint="Letters and numbers only." />
        <TextField label="Email" defaultValue="not-an-email" error="Enter a valid email address." />
        <TextField label="Locked" defaultValue="Cannot edit" disabled />
        <TextArea label="Message" hint="A short note to whoever you are sharing with." />
      </div>
    </article>
  );
}
