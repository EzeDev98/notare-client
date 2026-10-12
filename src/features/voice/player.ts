import { useSyncExternalStore } from 'react';

import { gateway } from '@/core/adapter';
import { clipRepository } from '@/features/notes/local/clipRepository';

/** "0:42". Whole seconds, minutes unpadded. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}

export interface ClipPlayback {
  playing: boolean;
  loading: boolean;
  failed: boolean;
  /** Seconds played so far. */
  position: number;
  /** Seconds in total. The clip's own length until the browser knows better. */
  duration: number;
}

const IDLE: ClipPlayback = { playing: false, loading: false, failed: false, position: 0, duration: 0 };

/*
 * The one audio player (step 12g). A single <audio> element lives here, so a
 * second clip starting always stops the first. Blocks read their own slice
 * through useClipPlayback.
 */
let activeId: string | null = null;
let current: ClipPlayback = IDLE;
let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let ticket = 0;
const listeners = new Set<() => void>();

function publish(next: ClipPlayback): void {
  current = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function release(): void {
  ticket += 1;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }
  if (objectUrl !== null) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  activeId = null;
  publish(IDLE);
}

/** Local bytes first. Otherwise fetch them and keep them on the device. */
async function blobFor(clipId: string): Promise<{ blob: Blob; seconds: number }> {
  const clip = await clipRepository.get(clipId);
  if (!clip) throw new Error('Clip not found');
  const seconds = clip.durationSeconds ?? 0;
  if (clip.audio) return { blob: clip.audio, seconds };
  if (clip.serverId === null) throw new Error('Clip has no audio');

  const blob = await gateway.downloadClip(clip.serverId);
  try {
    await clipRepository.put({ ...clip, audio: blob });
  } catch {
    // Not enough room to keep it. It still plays this time.
  }
  return { blob, seconds };
}

export async function playClip(clipId: string): Promise<void> {
  if (activeId === clipId && audio) {
    await audio.play().catch(() => undefined);
    return;
  }

  release();
  activeId = clipId;
  const mine = ticket;
  publish({ ...IDLE, loading: true });

  try {
    const { blob, seconds } = await blobFor(clipId);
    if (mine !== ticket) return;

    objectUrl = URL.createObjectURL(blob);
    const element = new Audio(objectUrl);
    audio = element;
    const total = (): number => (Number.isFinite(element.duration) && element.duration > 0 ? element.duration : seconds);

    element.addEventListener('play', () => {
      publish({ playing: true, loading: false, failed: false, position: element.currentTime, duration: total() });
    });
    element.addEventListener('pause', () => {
      if (mine === ticket) publish({ ...current, playing: false });
    });
    element.addEventListener('timeupdate', () => {
      publish({ playing: !element.paused, loading: false, failed: false, position: element.currentTime, duration: total() });
    });
    element.addEventListener('ended', () => {
      if (mine === ticket) release();
    });
    element.addEventListener('error', () => {
      if (mine !== ticket) return;
      release();
      activeId = clipId;
      publish({ ...IDLE, failed: true });
    });

    await element.play();
  } catch {
    if (mine !== ticket) return;
    release();
    activeId = clipId;
    publish({ ...IDLE, failed: true });
  }
}

export function pauseClip(): void {
  audio?.pause();
}

/** Stops whatever is playing. Called when a note closes. */
export function stopPlayback(): void {
  release();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** This clip's playback. Every other clip reads as idle. */
export function useClipPlayback(clipId: string): ClipPlayback {
  return useSyncExternalStore(subscribe, () => (activeId === clipId ? current : IDLE));
}
