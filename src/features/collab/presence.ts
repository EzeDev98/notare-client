import type { EditorState } from '@tiptap/pm/state';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import type { Awareness } from 'y-protocols/awareness';
import { createRelativePositionFromJSON, type Doc, type RelativePosition, type XmlFragment } from 'yjs';

import { displayName } from '@/features/auth/displayName';
import type { CurrentUser } from '@/features/auth/types';

/** The six collaborator colours, --color-cursor-1 to --color-cursor-6. */
export type CursorColor = 1 | 2 | 3 | 4 | 5 | 6;

const COLOR_COUNT = 6;
const NAME_MAX_CHARS = 80;

/**
 * One person, one colour, on every device: a stable hash of the user id (master 6.5). The high
 * bits are used so neighbouring ids do not get neighbouring colours.
 */
export function colorIndexFor(userId: number): CursorColor {
  const hash = Math.imul(Math.trunc(userId) | 0, 0x9e3779b1) >>> 0;
  return (((hash >>> 16) % COLOR_COUNT) + 1) as CursorColor;
}

/** What this device tells the others, as Awareness local state. `cursor` holds Yjs relative positions. */
export interface PresenceState {
  userId: number;
  name: string;
  colorIndex: CursorColor;
  /** Can edit the note, so the people list can say "editing" or "viewing" (step 16e). */
  editing: boolean;
  cursor: { anchor: RelativePosition; head: RelativePosition } | null;
}

export function localPresence(user: CurrentUser, editing: boolean): PresenceState {
  return { userId: user.id, name: displayName(user), colorIndex: colorIndexFor(user.id), editing, cursor: null };
}

/** Another device's presence. `clientId` is its Awareness client id. */
export interface RemotePerson extends Omit<PresenceState, 'cursor'> {
  clientId: number;
  cursor: PresenceState['cursor'];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function parseCursor(raw: unknown): PresenceState['cursor'] {
  if (!isRecord(raw) || !isRecord(raw['anchor']) || !isRecord(raw['head'])) return null;
  try {
    return { anchor: createRelativePositionFromJSON(raw['anchor']), head: createRelativePositionFromJSON(raw['head']) };
  } catch {
    return null;
  }
}

/** Everyone else in the note. What arrives from the network is checked, never trusted. */
export function remotePeople(awareness: Awareness): RemotePerson[] {
  const people: RemotePerson[] = [];
  for (const [clientId, raw] of awareness.getStates()) {
    if (clientId === awareness.clientID || !isRecord(raw)) continue;
    const userId = raw['userId'];
    const name = raw['name'];
    if (typeof userId !== 'number' || typeof name !== 'string') continue;
    const colour = raw['colorIndex'];
    const colorIndex =
      typeof colour === 'number' && Number.isInteger(colour) && colour >= 1 && colour <= COLOR_COUNT
        ? (colour as CursorColor)
        : colorIndexFor(userId);
    people.push({
      clientId,
      userId,
      name: name.slice(0, NAME_MAX_CHARS),
      colorIndex,
      editing: raw['editing'] === true,
      cursor: parseCursor(raw['cursor']),
    });
  }
  return people;
}

// ---- Positions: ProseMirror numbers <-> Yjs relative positions --------------

interface SyncState {
  doc: Doc;
  type: XmlFragment;
  binding: { mapping: Parameters<typeof relativePositionToAbsolutePosition>[3] } | null;
}

const syncStateOf = (state: EditorState): SyncState | null =>
  (ySyncPluginKey.getState(state) as SyncState | undefined) ?? null;

/** The selection as relative positions, so it survives other people's edits. */
export function cursorOf(state: EditorState): PresenceState['cursor'] {
  const sync = syncStateOf(state);
  if (!sync?.binding) return null;
  const { anchor, head } = state.selection;
  return {
    anchor: absolutePositionToRelativePosition(anchor, sync.type, sync.binding.mapping),
    head: absolutePositionToRelativePosition(head, sync.type, sync.binding.mapping),
  };
}

/** A remote relative position as a position in the editor now, or null when it cannot be placed. */
export function absoluteOf(state: EditorState, position: RelativePosition): number | null {
  const sync = syncStateOf(state);
  if (!sync?.binding) return null;
  const at = relativePositionToAbsolutePosition(sync.doc, sync.type, position, sync.binding.mapping);
  return at === null ? null : Math.min(at, state.doc.content.size);
}
