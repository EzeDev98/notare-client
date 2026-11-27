/** Settings: Terms and Privacy. */
import { ROUTES } from '@/app/routes';
import { PageHeader, ScreenContainer } from '@/design-system/ui';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import { LEGAL_DOCS, type LegalKey } from './legalContent';
import './Settings.css';
import { useBackToHub } from './useBackToHub';

function LegalScreen({ doc }: { doc: LegalKey }) {
  const { title, body } = LEGAL_DOCS[doc];
  useDocumentTitle(title);
  const back = useBackToHub(ROUTES.settingsAbout());

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={title} onBack={back} />}>
      <div className="set__stack set__stack--tight">
        {body.map((paragraph) => (
          <p key={paragraph} className="set__note set__note--body">
            {paragraph}
          </p>
        ))}
      </div>
    </ScreenContainer>
  );
}

export function SettingsTermsPage() {
  return <LegalScreen doc="terms" />;
}

export function SettingsPrivacyPage() {
  return <LegalScreen doc="privacy" />;
}
