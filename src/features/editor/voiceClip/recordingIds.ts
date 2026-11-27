/** Temporary ids for clips still recording. */
import type { Editor } from '@tiptap/core';

const PREFIX = 'recording:';
const live = new Set<string>();

export function isRecordingId(clipId: string): boolean {
  return clipId.startsWith(PREFIX);
}

export function isLiveRecording(clipId: string): boolean {
  return live.has(clipId);
}

export function endRecording(clipId: string): void {
  live.delete(clipId);
}

export function insertVoiceClip(editor: Editor): void {
  const clipId = `${PREFIX}${crypto.randomUUID()}`;
  live.add(clipId);
  editor
    .chain()
    .focus()
    .insertContent([{ type: 'voiceClip', attrs: { clipId } }, { type: 'paragraph' }])
    .run();
}
