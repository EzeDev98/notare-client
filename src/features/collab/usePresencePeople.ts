import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import { remotePeople, type CursorColor } from '@/features/collab/presence';

/** One other person in the note. A person on two devices is one person. */
export interface PresentPerson {
  userId: number;
  name: string;
  colorIndex: CursorColor;
  /** Can edit the note (an Editor or the owner), as opposed to only reading it. */
  editing: boolean;
}

function groupByPerson(awareness: Awareness): PresentPerson[] {
  const byUser = new Map<number, PresentPerson>();
  for (const person of remotePeople(awareness)) {
    const known = byUser.get(person.userId);
    if (known) known.editing ||= person.editing;
    else byUser.set(person.userId, { userId: person.userId, name: person.name, colorIndex: person.colorIndex, editing: person.editing });
  }
  return [...byUser.values()].sort((a, b) => a.userId - b.userId);
}

const sameList = (a: readonly PresentPerson[], b: readonly PresentPerson[]): boolean =>
  a.length === b.length &&
  a.every((person, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      person.userId === other.userId &&
      person.name === other.name &&
      person.colorIndex === other.colorIndex &&
      person.editing === other.editing
    );
  });

/**
 * The other people in the open note, from Awareness (step 16e). A caret moving fires Awareness
 * changes all the time; the list only changes when somebody joins, leaves or changes mode, so the
 * header does not redraw on every keystroke someone else types.
 */
export function usePresencePeople(awareness: Awareness | undefined): readonly PresentPerson[] {
  const [people, setPeople] = useState<readonly PresentPerson[]>([]);

  useEffect(() => {
    if (!awareness) {
      setPeople([]);
      return undefined;
    }
    const update = (): void => {
      const next = groupByPerson(awareness);
      setPeople((previous) => (sameList(previous, next) ? previous : next));
    };
    update();
    awareness.on('change', update);
    return () => {
      awareness.off('change', update);
    };
  }, [awareness]);

  return people;
}
