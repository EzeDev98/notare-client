import { useEffect, useState } from 'react';

import { gateway } from '@/core/adapter';

export type AudioBlobState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

/**
 * Fetches a voice note's bytes as an authenticated `Blob` and exposes a
 * `blob:` object URL for `<audio src>` — the fallback path §1.4 sanctions
 * until the service worker (Step 11) can attach `Authorization` to a
 * native ranged `<audio>` request. See `gateway.downloadClip`'s
 * own doc comment for the full reasoning.
 *
 * The object URL is revoked on unmount AND whenever `voiceNoteId` changes
 * — `URL.createObjectURL` leaks memory for as long as the URL lives if
 * nothing calls `revokeObjectURL`, and switching between two voice notes
 * in the same session without this would leak one blob per note played.
 */
export function useAudioBlob(voiceNoteId: number | null, enabled = false): AudioBlobState {
  const [state, setState] = useState<AudioBlobState>({ status: 'idle' });

  useEffect(() => {
    if (voiceNoteId === null || !enabled) {
      setState({ status: 'idle' });
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState({ status: 'loading' });

    let cancelled = false;

    gateway
      .downloadClip(voiceNoteId, { signal: controller.signal })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl });
      })
      .catch((error: unknown) => {
        // A deliberate cancellation (unmount, id change, or a newer
        // request superseding this one) rejects with AbortError. That is
        // not a load failure — it must never surface the error UI, or
        // navigating between notes flashes "Couldn't load recording" for
        // one frame on every voice note, every time.
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [voiceNoteId, enabled]);

  return state;
}
