import { Mic, Redo2, Undo2 } from 'lucide-react';
import type { Ref } from 'react';

import { IconButton } from '../IconButton/IconButton';

import './AccessoryStrip.css';

interface AccessoryStripProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  /** Without a handler the Voice clip button is left out. */
  onVoice?: (() => void) | undefined;
  /** Fixed over the keyboard, edge to edge. The caller places it (bottom, left, width) through `ref`. */
  docked?: boolean | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
}

/** The phone strip above the keyboard: Undo, Redo, a spacer, Voice clip. */
export function AccessoryStrip({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onVoice,
  docked,
  ref,
}: AccessoryStripProps) {
  return (
    <div
      ref={ref}
      className={docked ? 'n-accessory n-accessory--docked' : 'n-accessory'}
      role="toolbar"
      aria-label="Editing"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <IconButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={onUndo} />
      <IconButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={onRedo} />
      <span className="n-accessory__spacer" />
      {onVoice ? <IconButton icon={Mic} label="Voice clip" onClick={onVoice} /> : null}
    </div>
  );
}
