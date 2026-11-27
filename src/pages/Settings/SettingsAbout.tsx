import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { Card, PageHeader, ScreenContainer } from '@/design-system/ui';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { LEGAL_DOCS } from './legalContent';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.about;

/** Settings > About and legal (master 6.6): Terms and Privacy. */
export function SettingsAboutPage() {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const navigate = useNavigate();

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        <div className="set__about">
          <p className="set__note">{COPY.tagline}</p>
        </div>

        <SettingsSection heading={COPY.legal}>
          <Card className="set__card">
            <ul className="set__list">
              <SettingsRow
                label={LEGAL_DOCS.terms.title}
                onSelect={() => {
                  void navigate(ROUTES.settingsTerms());
                }}
              />
              <SettingsRow
                label={LEGAL_DOCS.privacy.title}
                onSelect={() => {
                  void navigate(ROUTES.settingsPrivacy());
                }}
              />
            </ul>
          </Card>
        </SettingsSection>
      </div>
    </ScreenContainer>
  );
}
