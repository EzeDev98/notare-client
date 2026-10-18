import { useState } from 'react';

import { tintFor } from '@/design-system/lib/tint';
import { Button, Card, PersonRow, ScreenContainer, useToast } from '@/design-system/ui';
import { PEOPLE_COPY } from '@/features/collaboration/peopleContent';
import { useNoteList } from '@/features/notes/list/useNoteList';
import { peopleRepository } from '@/features/notes/local/peopleRepository';
import { FindPeopleModal } from '@/pages/Home/FindPeopleModal';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

import { LANDING_COPY } from './landingContent';
import './ViewLanding.css';

const COPY = LANDING_COPY.shared;

/** The note pane on Shared with me: how sharing works when it is empty, who you are connected with when it is not. */
export function SharedLanding({ ownerId, username }: { ownerId: number; username: string }) {
  const items = useNoteList('shared', ownerId, '');
  const people = useStableLiveQuery(() => peopleRepository.list(), []);
  const [finding, setFinding] = useState(false);
  const { toast } = useToast();

  if (items === undefined || people === undefined) return null;

  const copyUsername = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      toast(COPY.username.copied);
    } catch {
      toast(COPY.username.failed, { tone: 'error' });
    }
  };

  const connected = people
    .filter((person) => person.state === 'connected')
    .sort((a, b) => a.name.localeCompare(b.name));
  const owners = new Set(
    items.flatMap((item) => (item.ownerName === null ? [] : [item.ownerName])),
  );
  const empty = items.length === 0;

  return (
    <ScreenContainer placement="top">
      <div className="vl">
        <p className="vl__lede">{empty ? COPY.lede : COPY.summary(items.length, owners.size)}</p>

        {empty ? (
          <>
            <section className="vl__sec" aria-label={COPY.how.heading}>
              <h2 className="vl__h">{COPY.how.heading}</h2>
              <Card className="vl__card">
                <ol className="vl__steps">
                  {COPY.how.steps.map((step, index) => (
                    <li key={step.title} className="vl__step">
                      <span className="vl__n" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <p className="vl__title">{step.title}</p>
                        <p className="vl__muted">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>

            <section className="vl__sec" aria-label={COPY.username.heading}>
              <h2 className="vl__h">{COPY.username.heading}</h2>
              <Card className="vl__card vl__row">
                <p className="vl__muted vl__grow">{COPY.username.label}</p>
                <code className="vl__code">{`@${username}`}</code>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void copyUsername();
                  }}
                >
                  {COPY.username.copy}
                </Button>
              </Card>
            </section>
          </>
        ) : connected.length > 0 ? (
          <section className="vl__sec" aria-label={COPY.people}>
            <h2 className="vl__h">{COPY.people}</h2>
            <Card className="vl__pad">
              <div role="list">
                {connected.map((person) => (
                  <PersonRow
                    key={person.id}
                    name={person.name}
                    username={person.username}
                    tint={tintFor(person.id)}
                    state="connected"
                  />
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        <div className="vl__actions">
          <Button
            variant={empty ? 'primary' : 'secondary'}
            onClick={() => {
              setFinding(true);
            }}
          >
            {PEOPLE_COPY.find}
          </Button>
        </div>

        {empty ? null : <p className="vl__hint">{COPY.hint}</p>}
      </div>

      <FindPeopleModal
        open={finding}
        onClose={() => {
          setFinding(false);
        }}
      />
    </ScreenContainer>
  );
}
