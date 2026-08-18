import { useSharedAudioBlob } from '@/features/sharedVoiceNotes/hooks/useSharedAudioBlob';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import './SharedAudioPlayer.css';

interface SharedAudioPlayerProps {
  voiceNoteId: number;
}

/**
 * The recipient-side counterpart to `AudioPlayer` — same native
 * `<audio controls>`-over-object-URL shape, `useSharedAudioBlob` (grant-
 * gated) in place of `useAudioBlob` (owner-only) underneath. A SEPARATE
 * component for the same reason `useSharedAudioBlob` is a separate hook,
 * not `AudioPlayer` reused: this is `/shared-voice/:id`'s own player, never
 * the owner's `VoiceDetailPage` component reached through a permission
 * branch.
 */
export function SharedAudioPlayer({ voiceNoteId }: SharedAudioPlayerProps) {
  const blob = useSharedAudioBlob(voiceNoteId);

  if (blob.status === 'loading') {
    return (
      <div className="shared-audio-player shared-audio-player--centre">
        <Spinner label="Loading recording" size="sm" />
      </div>
    );
  }

  if (blob.status === 'error') {
    return (
      <div className="shared-audio-player shared-audio-player--centre" role="alert">
        <p>Couldn&apos;t load this recording.</p>
      </div>
    );
  }

  return (
    <div className="shared-audio-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a voice
          memo has no track to caption, same reasoning as AudioPlayer's own
          identical exemption. */}
      <audio className="shared-audio-player__control" controls src={blob.url} />
    </div>
  );
}
