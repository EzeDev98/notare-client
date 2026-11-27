/** Onboarding: what using Notare in the browser means. */
import { useState } from 'react';

import { Button } from '@/design-system/ui';
import { BROWSER } from '@/features/onboarding/onboardingContent';

import { TransferHero } from './OnboardingHero';
import { OnboardingScreen } from './OnboardingScreen';
import { useInstallAction } from './useInstallAction';

interface BrowserScreenProps {
  onBack: () => void;
  onInstalled: () => void;
  onManual: () => void;
  onContinue: () => Promise<void>;
}

export function BrowserScreen({ onBack, onInstalled, onManual, onContinue }: BrowserScreenProps) {
  const { busy, install } = useInstallAction({ onInstalled, onManual });
  const [leaving, setLeaving] = useState(false);

  function carryOn(): void {
    setLeaving(true);
    void onContinue();
  }

  return (
    <OnboardingScreen
      hero={<TransferHero />}
      title={BROWSER.title}
      description={BROWSER.description}
      onBack={onBack}
      footer={
        <>
          <Button variant="primary" block busy={leaving} onClick={carryOn}>
            {BROWSER.cta}
          </Button>
          <Button variant="ghost" block busy={busy} onClick={() => void install()}>
            {BROWSER.install}
          </Button>
        </>
      }
    />
  );
}
