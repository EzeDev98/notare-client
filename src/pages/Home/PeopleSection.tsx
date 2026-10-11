import { useEffect, useState } from 'react';

import { tintFor } from '@/design-system/lib/tint';
import { Button, PersonRow, useToast } from '@/design-system/ui';
import { useCancelCollaboration } from '@/features/collaboration/hooks/useCollaborationMutations';
import { PEOPLE_COPY } from '@/features/collaboration/peopleContent';
import { refreshPeople } from '@/features/collaboration/refreshPeople';
import { peopleRepository } from '@/features/notes/local/peopleRepository';
import { refreshShared } from '@/features/sharedNotes/refreshShared';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import { FindPeopleModal } from './FindPeopleModal';

/** The top of Shared with me: who you are connected with, and Find people. */
export function PeopleSection() {
  const people = useStableLiveQuery(() => peopleRepository.list(), []);
  const [finding, setFinding] = useState(false);
  const cancel = useCancelCollaboration();
  const { toast } = useToast();

  // Opening Shared with me asks the server again; offline, the cached lists stay.
  useEffect(() => {
    void Promise.allSettled([refreshPeople(), refreshShared()]);
  }, []);

  const cancelInvite = async (collaborationId: number) => {
    try {
      await cancel.mutateAsync(collaborationId);
      await refreshPeople().catch(() => undefined);
      toast(PEOPLE_COPY.toasts.cancelled);
    } catch {
      toast(PEOPLE_COPY.toasts.cancelFailed, { tone: 'error' });
    }
  };

  const rows = [...(people ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="home__people" aria-label={PEOPLE_COPY.heading}>
      <div className="home__head">
        <h2 className="home__sub">{PEOPLE_COPY.heading}</h2>
        <Button
          variant="secondary"
          onClick={() => {
            setFinding(true);
          }}
        >
          {PEOPLE_COPY.find}
        </Button>
      </div>
      {people === undefined ? null : rows.length > 0 ? (
        <div role="list">
          {rows.map((person) => (
            <PersonRow
              key={person.id}
              name={person.name}
              username={person.username}
              tint={tintFor(person.id)}
              state={person.state}
              onCancel={() => {
                void cancelInvite(person.collaborationId);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="home__none">{PEOPLE_COPY.none}</p>
      )}
      <FindPeopleModal
        open={finding}
        onClose={() => {
          setFinding(false);
        }}
      />
    </section>
  );
}
