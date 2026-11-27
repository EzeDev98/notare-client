/** The panel that shows a voice clip's transcript. */
import { Button } from '../Button/Button';

import './TranscriptPanel.css';

interface TranscriptPanelProps {
  id?: string | undefined;
  text: string;
  shown?: boolean | undefined;
  onCopy?: (() => void) | undefined;
  onInsert?: (() => void) | undefined;
}

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
