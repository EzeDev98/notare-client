import { useAudioBlob } from '@/features/voice/hooks/useAudioBlob';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './AudioPlayer.css';

interface AudioPlayerProps {
  voiceNoteId: number;
}

/**
 * "Player with seeking" (architecture doc §4.2's Voice detail screen).
 * A native `<audio controls>` over the object URL from `useAudioBlob` —
 * seeking within an already-downloaded blob is a browser feature, not a
 * network one, so this satisfies "seeking" today even without the Step 11
 * service worker. What's deferred is start-to-play latency on a large
 * file (the whole blob downloads before playback can begin); see
 * `voiceService.downloadVoiceNoteBlob`'s doc comment for the full
 * trade-off.
 */
export function AudioPlayer({ voiceNoteId }: AudioPlayerProps) {
  /*
   * `enabled: true` — this component IS the dedicated player (native
   * `<audio controls>`, always visible once mounted, no separate play
   * button of its own gating it). `useAudioBlob`'s `enabled` parameter
   * defaults to `false` specifically so a lazy consumer like
   * `InlineVoiceNote` can defer the download until its own play button is
   * pressed; leaving it at that default here meant the effect's own
   * `if (voiceNoteId === null || !enabled)` guard was true on every
   * render, so `voiceService.downloadVoiceNoteBlob` was never called at
   * all — `blob.status` sat at `'idle'` forever, which this component
   * renders identically to `'loading'` (see the check below), producing
   * exactly the "loads indefinitely, never plays" symptom: no network
   * request for the audio ever went out because none was ever asked for.
   */
  const blob = useAudioBlob(voiceNoteId, true);

  if (blob.status !== 'ready') {
    if (blob.status === 'error') {
      return (
        <div className="audio-player audio-player--centre" role="alert">
          <p>Couldn&apos;t load this recording.</p>
        </div>
      );
    }

    return (
      <div className="audio-player audio-player--centre">
        <Spinner label="Loading recording" size="sm" />
      </div>
    );
  }

  return (
    <div className="audio-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a voice
          memo has no track to caption; the transcript alongside it (when
          one exists) is the accessible equivalent. */}
      <audio className="audio-player__control" controls src={blob.url} />
    </div>
  );
}
