import { Mic, Redo2, Undo2 } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

import './AccessoryStrip.css';

interface AccessoryStripProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  onVoice?: (() => void) | undefined;
}

/** The phone strip above the keyboard: Undo, Redo, a spacer, Voice clip. */
export function AccessoryStrip({ canUndo, canRedo, onUndo, onRedo, onVoice }: AccessoryStripProps) {
  return (
    <div
      className="n-accessory"
      role="toolbar"
      aria-label="Editing"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <IconButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={onUndo} />
      <IconButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={onRedo} />
      <span className="n-accessory__spacer" />
      <IconButton icon={Mic} label="Voice clip" onClick={onVoice} />
    </div>
  );
}
