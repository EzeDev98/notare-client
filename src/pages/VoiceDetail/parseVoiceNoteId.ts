/**
 * Turns a route parameter into a voice-note id, or null. Same shape as
 * `parseNoteId` (`useNote.ts`) for the same reason: `Number('')` is `0`,
 * which would otherwise pass as a plausible id.
 *
 * Its own file (not exported from VoiceDetail.tsx) so that page can keep to
 * exporting only its component, and so `ShareVoiceNotePage` and
 * `SharedVoiceDetailPage` can parse the identical route param shape without a
 * second copy of this guard.
 */
export function parseVoiceNoteId(param: string | undefined): number | null {
  if (param === undefined) return null;
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}
