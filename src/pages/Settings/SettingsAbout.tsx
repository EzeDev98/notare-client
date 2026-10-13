import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useTheme } from '@/app/providers/theme-context';
import { ROUTES } from '@/app/routes';
import {
  Button,
  Card,
  DetailRow,
  InfoBanner,
  Logo,
  PageHeader,
  ScreenContainer,
  useToast,
} from '@/design-system/ui';
import { META_KEYS } from '@/features/notes/local/metaRow';
import { metaRepository } from '@/features/notes/local/metaRepository';
import { isOffline } from '@/lib/http/errors';
import { applyUpdate, checkForUpdates, onUpdateAvailable } from '@/pwa/registerServiceWorker';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useNow } from '@/shared/hooks/useNow';

import { ago } from './ago';
import { LEGAL_DOCS } from './legalContent';
import './Settings.css';
import { SETTINGS_COPY } from './settingsContent';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useBackToHub } from './useBackToHub';

const COPY = SETTINGS_COPY.about;

/** Settings > About and legal (master 6.6): version, update check, Terms and Privacy. */
export function SettingsAboutPage() {
  useDocumentTitle(COPY.title);
  const back = useBackToHub();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resolved } = useTheme();
  const now = useNow();
  const [checking, setChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);

  useEffect(() => {
    void metaRepository.get<number>(META_KEYS.updateCheckedAt).then((value) => {
      if (typeof value === 'number') setCheckedAt(value);
    });
  }, []);

  const check = async (): Promise<void> => {
    setChecking(true);
    try {
      const result = await checkForUpdates();
      const stamp = Date.now();
      setCheckedAt(stamp);
      await metaRepository.set(META_KEYS.updateCheckedAt, stamp);
      if (result === 'latest') toast(COPY.latest, { tone: 'success' });
    } catch (reason) {
      toast(isOffline(reason) ? SETTINGS_COPY.syncStorage.cannotReach : SETTINGS_COPY.confirm.failed, {
        tone: 'error',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScreenContainer placement="top" bar={<PageHeader title={COPY.title} onBack={back} />}>
      <div className="set__stack">
        <div className="set__about">
          <Logo scheme={resolved} size="lg" />
          <p className="set__note">{COPY.tagline}</p>
        </div>

        {updateReady ? (
          <InfoBanner
            title={COPY.update.title}
            action={
              <Button variant="secondary" onClick={applyUpdate}>
                {COPY.update.reload}
              </Button>
            }
          >
            {COPY.update.body}
          </InfoBanner>
        ) : null}

        <Card>
          <DetailRow label={COPY.version}>{__APP_VERSION__}</DetailRow>
          <DetailRow label={COPY.lastChecked}>
            {checkedAt === null ? COPY.never : ago(checkedAt, now)}
          </DetailRow>
        </Card>

        <div>
          <Button
            variant="secondary"
            busy={checking}
            onClick={() => {
              void check();
            }}
          >
            {COPY.check}
          </Button>
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
