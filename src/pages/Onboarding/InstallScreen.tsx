/** Onboarding: install Notare. */
import { Button } from '@/design-system/ui';
import { INSTALL } from '@/features/onboarding/onboardingContent';

import { TransferHero } from './OnboardingHero';
import { OnboardingScreen } from './OnboardingScreen';
import { useInstallAction } from './useInstallAction';

interface InstallScreenProps {
  onInstalled: () => void;
  onManual: () => void;
  onBrowser: () => void;
}

export function InstallScreen({ onInstalled, onManual, onBrowser }: InstallScreenProps) {
  const { busy, install } = useInstallAction({ onInstalled, onManual });

  return (
    <OnboardingScreen
      hero={<TransferHero />}
      title={INSTALL.title}
      description={INSTALL.description}
      footer={
        <>
          <Button variant="primary" block busy={busy} onClick={() => void install()}>
            {INSTALL.cta}
          </Button>
          <Button variant="ghost" block onClick={onBrowser}>
            {INSTALL.skip}
          </Button>
        </>
      }
    />
  );
}
