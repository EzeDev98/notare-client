/** Gallery row: PageHeader, ScreenContainer, FormScreen. */
import { useState } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import {
  Button,
  Card,
  FormScreen,
  Link,
  Logo,
  PageHeader,
  PasswordField,
  ScreenContainer,
  TextField,
} from '@/design-system/ui';

import { Both } from './Both';

type Demo = 'none' | 'form' | 'center' | 'top';

export function Row9() {
  const { resolved } = useTheme();
  const [demo, setDemo] = useState<Demo>('none');
  const close = () => {
    setDemo('none');
  };

  return (
    <>
      <h2 className="gallery-group">Row 9: PageHeader, ScreenContainer, FormScreen</h2>
      <Both title="PageHeader: back and action, long title, no back">
        <div className="gallery-stack">
          <PageHeader title="Settings" onBack={close} action={<Button variant="secondary">Save</Button>} />
          <PageHeader title="A very long screen title that has to be cut off with an ellipsis" onBack={close} />
          <PageHeader title="Notes" />
        </div>
      </Both>
      <section className="gallery-section">
        <h2 className="gallery-section__title">Full-screen layouts (Back closes them)</h2>
        <div className="gallery-row">
          <Button
            onClick={() => {
              setDemo('form');
            }}
          >
            FormScreen
          </Button>
          <Button
            onClick={() => {
              setDemo('center');
            }}
          >
            ScreenContainer, centred
          </Button>
          <Button
            onClick={() => {
              setDemo('top');
            }}
          >
            ScreenContainer, top
          </Button>
        </div>
      </section>

      {demo === 'none' ? null : (
        <div className="gallery-fullscreen">
          {demo === 'form' ? (
            <FormScreen
              title="Sign in"
              description="Welcome back to Notare."
              hero={<Logo scheme={resolved} size="lg" label="Notare" />}
              onBack={close}
              onSubmit={(event) => {
                event.preventDefault();
              }}
              footer={
                <>
                  <Button variant="primary" block type="submit">
                    Sign in
                  </Button>
                  <Link to="/dev/gallery">Forgot password?</Link>
                </>
              }
            >
              <TextField label="Email" type="email" placeholder="you@example.com" />
              <PasswordField label="Password" />
            </FormScreen>
          ) : (
            <ScreenContainer
              placement={demo === 'top' ? 'top' : 'center'}
              bar={<PageHeader title="Screen" onBack={close} />}
            >
              <Card>
                <p className="gallery-text">
                  {demo === 'top'
                    ? 'The group starts right under the bar.'
                    : 'The group sits in the vertical middle of the screen.'}
                </p>
              </Card>
            </ScreenContainer>
          )}
        </div>
      )}
    </>
  );
}
