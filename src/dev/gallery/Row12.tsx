import { useId, useState } from 'react';

import {
  AccessoryStrip,
  Button,
  StatusSlot,
  TranscriptPanel,
  VoiceBlock,
  type VoiceState,
} from '@/design-system/ui';

import { Both } from './Both';

const VOICE_STATES: readonly { state: VoiceState; label: string }[] = [
  { state: 'idle', label: 'Idle' },
  { state: 'playing', label: 'Playing' },
  { state: 'recording', label: 'Recording' },
  { state: 'saving', label: 'Saving' },
  { state: 'waiting', label: 'Waiting to upload (offline)' },
  { state: 'upload-failed', label: 'Upload failed' },
  { state: 'transcribe', label: 'Ready to transcribe' },
  { state: 'transcribe-waiting', label: 'Waiting to transcribe (offline)' },
  { state: 'transcribing', label: 'Transcribing' },
  { state: 'transcribed', label: 'Transcribed' },
  { state: 'transcribe-failed', label: 'Transcription failed' },
  { state: 'permission-waiting', label: 'Waiting for microphone permission' },
  { state: 'mic-blocked', label: 'Microphone blocked' },
  { state: 'no-mic', label: 'No microphone found' },
];

const STATUSES = ['Saved', 'Saving', 'Offline', ''] as const;

/** Row 12: VoiceBlock, TranscriptPanel, StatusSlot, AccessoryStrip. */
export function Row12() {
  const panelId = useId();
  const [shown, setShown] = useState(true);
  const [status, setStatus] = useState<string>('Saved');

  return (
    <>
      <h2 className="gallery-group">Row 12: VoiceBlock, TranscriptPanel, header and editor parts</h2>

      <Both title="VoiceBlock: all 14 states">
        <div className="gallery-stack">
          {VOICE_STATES.map(({ state, label }) => (
            <div key={state}>
              <p className="gallery-muted">{label}</p>
              <VoiceBlock
                state={state}
                time={state === 'playing' ? '0:17 / 0:42' : state === 'recording' ? '0:07' : '0:42'}
                progress={40}
                transcriptShown={shown}
                transcriptId={panelId}
                onToggleTranscript={() => {
                  setShown((value) => !value);
                }}
              />
            </div>
          ))}
        </div>
      </Both>

      <Both title="TranscriptPanel: shown, hidden">
        <div className="gallery-stack">
          <TranscriptPanel text="Pick up the keys from the office, then call the landlord about the water meter." />
          <Button
            onClick={() => {
              setShown((value) => !value);
            }}
          >
            {shown ? 'Hide' : 'Show'} the panel below
          </Button>
          <TranscriptPanel id={panelId} shown={shown} text="This panel is toggled by the button above and by the voice block." />
        </div>
      </Both>

      <Both title="StatusSlot: swaps without moving anything beside it">
        <div className="gallery-row">
          <StatusSlot status={status} />
          {STATUSES.map((value) => (
            <Button
              key={value || 'empty'}
              onClick={() => {
                setStatus(value);
              }}
            >
              {value || 'Empty'}
            </Button>
          ))}
        </div>
      </Both>

      <Both title="AccessoryStrip">
        <div className="gallery-stack">
          <AccessoryStrip canUndo={false} canRedo={false} />
          <AccessoryStrip canUndo canRedo={false} />
          <AccessoryStrip canUndo canRedo />
        </div>
      </Both>
    </>
  );
}
