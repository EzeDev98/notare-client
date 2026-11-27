import { Button } from '../Button/Button';

import './TranscriptPanel.css';

interface TranscriptPanelProps {
  /** Lets the voice block's "Show transcript" button point at this panel (aria-controls). */
  id?: string | undefined;
  text: string;
  /** False hides the panel but keeps it in the page. Default true. */
  shown?: boolean | undefined;
  onCopy?: (() => void) | undefined;
  onInsert?: (() => void) | undefined;
}

/** The transcript of a voice clip with Copy and Insert into note. */
export function TranscriptPanel({ id, text, shown = true, onCopy, onInsert }: TranscriptPanelProps) {
  return (
    <div className="n-transcript" id={id} hidden={!shown}>
      <p className="n-transcript__label">Transcript</p>
      <p className="n-transcript__text">{text}</p>
      <div className="n-transcript__actions">
        <Button variant="ghost" onClick={onCopy}>
          Copy
        </Button>
        <Button variant="secondary" onClick={onInsert}>
          Insert into note
        </Button>
      </div>
    </div>
  );
}
