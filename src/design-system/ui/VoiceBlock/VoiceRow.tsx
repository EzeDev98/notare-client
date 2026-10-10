import { Pause, Play, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';

import { Spinner } from '../Spinner/Spinner';

import { Bar, MicTile, Track, Word } from './VoiceParts';

export type VoiceState =
  | 'idle'
  | 'playing'
  | 'recording'
  | 'saving'
  | 'waiting'
  | 'upload-failed'
  | 'transcribe'
  | 'transcribe-waiting'
  | 'transcribing'
  | 'transcribed'
  | 'transcribe-failed'
  | 'permission-waiting'
  | 'mic-blocked'
  | 'no-mic';

export interface VoiceBlockProps {
  state: VoiceState;
  /** Time text such as "0:42". */
  time?: string | undefined;
  /** 0 to 100, used by the playing state. */
  progress?: number | undefined;
  transcriptShown?: boolean | undefined;
  /** id of the transcript panel, so the toggle can point at it. */
  transcriptId?: string | undefined;
  onPlay?: (() => void) | undefined;
  onPause?: (() => void) | undefined;
  onStop?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  onTranscribe?: (() => void) | undefined;
  onToggleTranscript?: (() => void) | undefined;
  onTryAgain?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}

export interface VoiceView {
  row: ReactNode;
  recording: boolean;
  help: string | null;
}

const VIEW = (row: ReactNode, help: string | null = null, recording = false): VoiceView => ({ row, recording, help });

/** Maps one voice state to its row, its help line and whether it is recording. */
export function voiceView(p: VoiceBlockProps): VoiceView {
  const time = <span className="n-voice__time">{p.time ?? '0:42'}</span>;
  const play = <IconButton icon={Play} label="Play voice clip" onClick={p.onPlay} />;
  const bar = (
    <Track>
      <Bar progress={p.progress} />
    </Track>
  );
  const spinner = <Spinner decorative size="sm" className="n-voice__spinner" />;
  const ghost = (label: string, onClick?: () => void) => (
    <Button variant="ghost" onClick={onClick}>
      {label}
    </Button>
  );
  const remove = <IconButton icon={X} label="Remove voice clip" onClick={p.onRemove} />;
  const say = (text: string, error = false) => (
    <Track>
      <Word error={error}>{text}</Word>
    </Track>
  );

  switch (p.state) {
    case 'idle':
      return VIEW(<>{play}{bar}{time}</>);
    case 'playing':
      return VIEW(<><IconButton icon={Pause} label="Pause voice clip" onClick={p.onPause} />{bar}{time}</>);
    case 'recording':
      return VIEW(
        <>
          <IconButton icon={Square} label="Stop recording" onClick={p.onStop} />
          <span className="n-voice__dot" aria-hidden="true" />
          <Track>
            <span className="n-voice__time">Recording</span>
          </Track>
          {time}
        </>,
        null,
        true,
      );
    case 'saving':
      return VIEW(<><MicTile />{say('Saving on this device')}{spinner}</>);
    case 'waiting':
      return VIEW(<>{play}{bar}<Word>Not synced</Word>{time}</>);
    case 'upload-failed':
      return VIEW(<>{play}{say('Could not upload', true)}{ghost('Retry', p.onRetry)}</>);
    case 'transcribe':
      return VIEW(<>{play}{bar}{time}{ghost('Transcribe', p.onTranscribe)}</>);
    case 'transcribe-waiting':
      return VIEW(
        <>{play}{say('Waiting for connection')}{time}</>,
        'Transcription starts when you are back online. The clip is safe on this device.',
      );
    case 'transcribing':
      return VIEW(
        <>{play}{say('Transcribing')}{spinner}{time}</>,
        'This can take a minute. You can keep writing.',
      );
    case 'transcribed':
      return VIEW(
        <>
          {play}
          {bar}
          {time}
          <Button
            variant="ghost"
            aria-expanded={p.transcriptShown ?? false}
            aria-controls={p.transcriptId}
            onClick={p.onToggleTranscript}
          >
            {p.transcriptShown ? 'Hide transcript' : 'Show transcript'}
          </Button>
        </>,
      );
    case 'transcribe-failed':
      return VIEW(<>{play}{say('Could not transcribe this clip. Try again.', true)}{ghost('Retry', p.onRetry)}</>);
    case 'permission-waiting':
      return VIEW(
        <><MicTile />{say('Waiting for permission')}</>,
        'Choose Allow when your browser asks to use the microphone.',
      );
    case 'mic-blocked':
      return VIEW(
        <><MicTile />{say('Microphone blocked', true)}{ghost('Try again', p.onTryAgain)}{remove}</>,
        'Allow microphone access in your browser settings, then try again.',
      );
    case 'no-mic':
      return VIEW(
        <><MicTile />{say('No microphone found', true)}{ghost('Try again', p.onTryAgain)}{remove}</>,
        'Connect a microphone, then try again.',
      );
  }
}
