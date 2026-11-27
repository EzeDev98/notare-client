/** The voice clip row, in every state from recording to transcript. */
import { voiceView, type VoiceBlockProps } from './VoiceRow';

import './VoiceBlock.css';

export type { VoiceBlockProps, VoiceState } from './VoiceRow';

export function VoiceBlock(props: VoiceBlockProps) {
  const { row, recording, help } = voiceView(props);
  return (
    <div className="n-voice-wrap" role="group" aria-label="Voice clip">
      <div className={recording ? 'n-voice n-voice--recording' : 'n-voice'}>{row}</div>
      {help ? <p className="n-voice__help">{help}</p> : null}
    </div>
  );
}
