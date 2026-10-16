import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useSessionUser } from '@/app/shell/useSessionUser';
import { Button, Icon, Overlay, PersonRow, SelectField, TextField, useToast } from '@/design-system/ui';
import { COLLAB_COPY } from '@/features/collab/collabContent';
import { colorIndexFor } from '@/features/collab/presence';
import { useCreateShare, useRevokeShare, useUpdateShare } from '@/features/sharing/hooks/useShareMutations';
import { useShares } from '@/features/sharing/hooks/useShares';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import type { PersonRow as PersonData } from '@/features/notes/local/personRow';
import { peopleRepository } from '@/features/notes/local/peopleRepository';
import { isOffline, statusOf } from '@/lib/http/errors';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import './ShareModal.css';

const COPY = COLLAB_COPY.share;

interface ShareModalProps {
  /** The server id of the note. Sharing needs the note to exist on the server. */
  noteId: number;
  open: boolean;
  onClose: () => void;
}

const matches = (person: PersonData, term: string): boolean =>
  person.name.toLowerCase().includes(term) || person.username.toLowerCase().includes(term);

/** Who has access, and who can be added. Everything that needs the server is read while the modal is open. */
function ShareBody({ noteId }: { noteId: number }) {
  const { toast } = useToast();
  const me = useSessionUser();
  const shares = useShares(noteId);
  const create = useCreateShare(noteId);
  const update = useUpdateShare(noteId);
  const revoke = useRevokeShare(noteId);
  const people = useStableLiveQuery(() => peopleRepository.list(), []);
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');

  const grants = useMemo(() => shares.data?.content ?? [], [shares.data]);
  const grantIds = useMemo(() => grants.map((grant) => grant.sharedWithUserId), [grants]);
  const { profiles } = useUserLookup(grantIds);

  const connected = useMemo(() => (people ?? []).filter((person) => person.state === 'connected'), [people]);
  const taken = useMemo(() => new Set(grantIds), [grantIds]);

  /** The server sends bare ids: names come from your People list first, then one lookup for the rest. */
  const who = (userId: number): { name: string; username: string } => {
    const person = connected.find((candidate) => candidate.id === userId);
    if (person) return { name: person.name, username: person.username };
    const profile = profiles.get(userId);
    return { name: formatUserName(profile), username: profile?.username ?? '' };
  };

  // Searching shows only people you are connected with, and only those without access yet (O-21 A).
  const search = term.trim().toLowerCase();
  const results = search === '' ? [] : connected.filter((person) => !taken.has(person.id) && matches(person, search));
  const alreadyHasAccess =
    search !== '' && results.length === 0 && connected.some((person) => taken.has(person.id) && matches(person, search));
  const fieldError = error !== '' ? error : alreadyHasAccess ? COPY.alreadyHasAccess : '';
  const busy = update.isPending || revoke.isPending;

  const failed = (failure: unknown): void => {
    toast(isOffline(failure) ? COPY.toasts.offline : COPY.toasts.failed, { tone: 'error' });
  };

  const invite = async (person: PersonData): Promise<void> => {
    if (create.isPending) return;
    setError('');
    try {
      await create.mutateAsync({ sharedWithUserId: person.id, permission: 'READ' });
      setTerm('');
      toast(COPY.toasts.shared(person.name), { tone: 'success' });
    } catch (failure) {
      if (statusOf(failure) === 409) setError(COPY.alreadyHasAccess);
      else failed(failure);
    }
  };

  const changeRole = async (userId: number, name: string, value: string): Promise<void> => {
    try {
      if (value === 'remove') {
        await revoke.mutateAsync(userId);
        toast(COPY.toasts.removed(name));
        return;
      }
      const permission = value === 'WRITE' ? 'WRITE' : 'READ';
      await update.mutateAsync({ userId, permission });
      if (permission === 'WRITE') toast(COPY.toasts.canEdit(name));
    } catch (failure) {
      failed(failure);
    }
  };

  /** What a row's select shows: the new choice straight away, before the server has answered. */
  const roleShown = (userId: number, saved: string): string => {
    if (revoke.isPending && revoke.variables === userId) return 'remove';
    if (update.isPending && update.variables.userId === userId) return update.variables.permission;
    return saved;
  };

  return (
    <div className="share">
      <TextField
        label={COPY.addLabel}
        hint={COPY.hint}
        {...(fieldError === '' ? {} : { error: fieldError })}
        placeholder={COPY.placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        data-autofocus
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setError('');
        }}
        leading={<Icon icon={Search} />}
      />

      <div role="list">
        {results.map((person) => (
          <PersonRow
            key={person.id}
            name={person.name}
            username={person.username}
            tint={colorIndexFor(person.id)}
            state="result"
            onInvite={() => {
              void invite(person);
            }}
          />
        ))}
      </div>
      {search !== '' && results.length === 0 && !alreadyHasAccess ? (
        <p className="share__none">{COPY.none(term.trim())}</p>
      ) : null}

      <div role="list">
        {me ? (
          <PersonRow
            name={COPY.you}
            username={me.username}
            tint={colorIndexFor(me.id)}
            trailing={<span className="n-person__static">{COPY.owner}</span>}
          />
        ) : null}
        {grants.map((grant) => {
          const person = who(grant.sharedWithUserId);
          return (
            <PersonRow
              key={grant.id}
              name={person.name}
              username={person.username}
              tint={colorIndexFor(grant.sharedWithUserId)}
              trailing={
                <div className="n-person__role">
                  <SelectField
                    label={COPY.roleFor(person.name)}
                    hideLabel
                    disabled={busy}
                    value={roleShown(grant.sharedWithUserId, grant.permission)}
                    onChange={(event) => {
                      void changeRole(grant.sharedWithUserId, person.name, event.target.value);
                    }}
                  >
                    <option value="READ">{COPY.roles.viewer}</option>
                    <option value="WRITE">{COPY.roles.editor}</option>
                    <option value="remove">{COPY.roles.remove}</option>
                  </SelectField>
                </div>
              }
            />
          );
        })}
      </div>
      {shares.isError ? <p className="share__none">{COPY.loadFailed}</p> : null}
    </div>
  );
}

/**
 * Share (step 16f), for the owner of a note. Search the people you are connected with, add them as
 * Viewers, change a role or remove access: each applies at once, with a toast.
 */
export function ShareModal({ noteId, open, onClose }: ShareModalProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={COPY.title}
      footer={
        <Button variant="primary" onClick={onClose}>
          {COPY.done}
        </Button>
      }
    >
      <ShareBody noteId={noteId} />
    </Overlay>
  );
}
