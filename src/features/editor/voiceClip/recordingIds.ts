import type { Editor } from '@tiptap/core';

/*
 * A block that is still recording has no clip yet. It carries a temporary id
 * until the clip is saved, then the node is given the real clip id.
 */
const PREFIX = 'recording:';
const live = new Set<string>();

export function isRecordingId(clipId: string): boolean {
  return clipId.startsWith(PREFIX);
}

/** True only for a recording this tab started and is still running. */
export function isLiveRecording(clipId: string): boolean {
  return live.has(clipId);
}

export function endRecording(clipId: string): void {
  live.delete(clipId);
}

/** Puts a recording block at the cursor, with an empty paragraph after it. */
export function insertVoiceClip(editor: Editor): void {
  const clipId = `${PREFIX}${crypto.randomUUID()}`;
  live.add(clipId);
  editor
    .chain()
    .focus()
    .insertContent([{ type: 'voiceClip', attrs: { clipId } }, { type: 'paragraph' }])
    .run();
}
