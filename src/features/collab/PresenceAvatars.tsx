import { AvatarStack, Menu } from '@/design-system/ui';
import { COLLAB_COPY } from '@/features/collab/collabContent';
import type { PresentPerson } from '@/features/collab/usePresencePeople';

import './PresenceAvatars.css';

/**
 * The people in the note as 24px avatars, at most 4 then "+N" (step 16e). Tapping them opens a
 * small list: each person with "editing" or "viewing".
 */
export function PresenceAvatars({ people }: { people: readonly PresentPerson[] }) {
  const items = people.map((person) => ({
    label: `${person.name}, ${person.editing ? COLLAB_COPY.editing : COLLAB_COPY.viewing}`,
    onSelect: () => undefined,
  }));

  return (
    <Menu label={COLLAB_COPY.peopleMenu} items={items}>
      {({ triggerProps }) => (
        <button type="button" className="presence-avatars" aria-label={COLLAB_COPY.peopleMenu} {...triggerProps}>
          <AvatarStack people={people.map((person) => ({ name: person.name, tint: person.colorIndex }))} />
        </button>
      )}
    </Menu>
  );
}
