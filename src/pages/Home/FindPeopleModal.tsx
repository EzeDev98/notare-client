import { Search } from 'lucide-react';
import { useState } from 'react';

import { tintFor } from '@/design-system/lib/tint';
import { Button, Icon, Overlay, PersonRow, TextField, useToast } from '@/design-system/ui';
import {
  useCancelCollaboration,
  useCreateCollaboration,
} from '@/features/collaboration/hooks/useCollaborationMutations';
import { useUserSearch } from '@/features/collaboration/hooks/useUserSearch';
import { PEOPLE_COPY } from '@/features/collaboration/peopleContent';
import { refreshPeople } from '@/features/collaboration/refreshPeople';
import { peopleRepository } from '@/features/notes/local/peopleRepository';
import { formatUserName } from '@/features/userLookup/hooks/useUserLookup';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

interface FindPeopleModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Search people by name or username and invite them. A blank search shows
 * nothing. A person must accept before you can share a note with them.
 */
export function FindPeopleModal({ open, onClose }: FindPeopleModalProps) {
  const [term, setTerm] = useState('');
  const { toast } = useToast();
  const people = useStableLiveQuery(() => peopleRepository.list(), []);
  const search = useUserSearch(term);
  const invite = useCreateCollaboration();
  const cancel = useCancelCollaboration();

  const trimmed = term.trim();
  const results = trimmed === '' ? [] : (search.data?.content ?? []);
  const known = new Map((people ?? []).map((person) => [person.id, person]));

  const close = () => {
    setTerm('');
    onClose();
  };

  const sendInvite = async (userId: number) => {
    if (invite.isPending) return;
    try {
      await invite.mutateAsync({ collaboratorId: userId });
      await refreshPeople().catch(() => undefined);
      toast(PEOPLE_COPY.toasts.invited, { tone: 'success' });
    } catch {
      toast(PEOPLE_COPY.toasts.inviteFailed, { tone: 'error' });
    }
  };

  const cancelInvite = async (collaborationId: number) => {
    try {
      await cancel.mutateAsync(collaborationId);
      await refreshPeople().catch(() => undefined);
      toast(PEOPLE_COPY.toasts.cancelled);
    } catch {
      toast(PEOPLE_COPY.toasts.cancelFailed, { tone: 'error' });
    }
  };

  return (
    <Overlay
      open={open}
      onClose={close}
      title={PEOPLE_COPY.modal.title}
      footer={
        <Button variant="primary" onClick={close}>
          {PEOPLE_COPY.modal.done}
        </Button>
      }
    >
      <div className="n-find">
        <TextField
          label={PEOPLE_COPY.modal.label}
          hint={PEOPLE_COPY.modal.hint}
          placeholder={PEOPLE_COPY.modal.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-autofocus
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
          }}
          leading={<Icon icon={Search} />}
        />
        <div role="list">
          {results.map((user) => {
            const person = known.get(user.id);
            return (
              <PersonRow
                key={user.id}
                name={formatUserName(user)}
                username={user.username}
                tint={tintFor(user.id)}
                state={person ? person.state : 'result'}
                onInvite={() => {
                  void sendInvite(user.id);
                }}
                onCancel={
                  person
                    ? () => {
                        void cancelInvite(person.collaborationId);
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
        {trimmed !== '' && search.isSuccess && results.length === 0 ? (
          <p className="home__none">{PEOPLE_COPY.modal.none(trimmed)}</p>
        ) : null}
        {trimmed !== '' && search.isError ? <p className="home__none">{PEOPLE_COPY.modal.failed}</p> : null}
      </div>
    </Overlay>
  );
}
