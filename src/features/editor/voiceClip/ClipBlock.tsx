/** A saved voice clip inside a note. */
import type { Editor } from '@tiptap/core';
import { useId, useState } from 'react';

import { TranscriptPanel, useToast } from '@/design-system/ui';
import { VoiceBlock, type VoiceBlockProps } from '@/design-system/ui/VoiceBlock/VoiceBlock';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { useClipTranscript } from '@/features/voice/hooks/useClipTranscript';
import { deleteClip } from '@/features/voice/deleteClip';
import { formatClock, pauseClip, playClip, useClipPlayback } from '@/features/voice/player';
import { requestTranscription } from '@/features/voice/transcribe';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

interface ClipSummary {
  uploadState: 'local' | 'uploading' | 'synced' | 'failed';
  durationSeconds: number;
}

interface ClipBlockProps {
  clipId: string;
  editor: Editor;
  getPos: () => number | undefined;
  nodeSize: number;
}

export function ClipBlock({ clipId, editor, getPos, nodeSize }: ClipBlockProps) {
  const playback = useClipPlayback(clipId);
  const transcript = useClipTranscript(clipId);
  const online = useOnlineStatus();
  const { toast } = useToast();
  const panelId = useId();
  const [shown, setShown] = useState(false);

  const clip = useLiveQuery(async (): Promise<ClipSummary | null> => {
    const row = await clipRepository.get(clipId);
    return row ? { uploadState: row.uploadState, durationSeconds: row.durationSeconds ?? 0 } : null;
  }, [clipId]);

  const total = playback.duration > 0 ? playback.duration : (clip?.durationSeconds ?? 0);
  const ask = (): void => {
    void requestTranscription(clipId);
  };

  const remove = (): void => {
    const pos = getPos();
    if (pos === undefined) return;
    if (playback.playing) pauseClip();
    editor
      .chain()
      .command(({ tr }) => {
        tr.delete(pos, pos + nodeSize);
        tr.setMeta('addToHistory', false);
        return true;
      })
      .run();
    void deleteClip(clipId);
  };

  const props: VoiceBlockProps = {
    state: 'idle',
    time: formatClock(total),
    onPlay: () => {
      void playClip(clipId);
    },
    onPause: pauseClip,
    onTranscribe: ask,
    onToggleTranscript: () => {
      setShown((value) => !value);
    },
    transcriptShown: shown,
    transcriptId: panelId,
    onRetry: () => {
      void clipRepository.retry(clipId);
    },
    onDelete: remove,
  };

  const status = transcript?.status ?? 'none';
  if (playback.playing) {
    props.state = 'playing';
    props.progress = total > 0 ? (playback.position / total) * 100 : 0;
    props.time = `${formatClock(playback.position)} / ${formatClock(total)}`;
  } else if (clip?.uploadState === 'failed') {
    props.state = 'upload-failed';
  } else if (clip && clip.uploadState !== 'synced') {
    props.state = 'waiting';
  } else if (status === 'queued' || (status === 'transcribing' && !online)) {
    props.state = 'transcribe-waiting';
  } else if (status === 'transcribing') {
    props.state = 'transcribing';
  } else if (status === 'failed') {
    props.state = 'transcribe-failed';
    props.onRetry = ask;
  } else if (status === 'done') {
    props.state = 'transcribed';
  } else if (clip) {
    props.state = 'transcribe';
  }

  const text = transcript?.text ?? '';

  const copy = (): void => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast('Transcript copied');
      },
      () => undefined,
    );
  };

  const insert = (): void => {
    const pos = getPos();
    if (pos === undefined) return;
    const paragraphs = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
    if (paragraphs.length === 0) return;
    editor.chain().insertContentAt(pos + nodeSize, paragraphs).run();
  };

  return (
    <>
      <VoiceBlock {...props} />
      {status === 'done' && text !== '' ? (
        <TranscriptPanel
          id={panelId}
          text={text}
          shown={shown}
          onCopy={copy}
          onInsert={insert}
        />
      ) : null}
    </>
  );
}
