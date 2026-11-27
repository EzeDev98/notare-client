/** Onboarding: steps to install by hand where the browser has no install dialog. */
import { Card, IconTile } from '@/design-system/ui';
import { MANUAL } from '@/features/onboarding/onboardingContent';
import { isIOS } from '@/pwa/installSupport';

import { TransferHero } from './OnboardingHero';
import { OnboardingScreen } from './OnboardingScreen';
import { RiseList } from './RiseList';

export function ManualScreen({ onBack }: { onBack: () => void }) {
  const steps = isIOS() ? MANUAL.ios : MANUAL.android;

  return (
    <OnboardingScreen hero={<TransferHero />} title={MANUAL.title} description={MANUAL.description} onBack={onBack}>
      <RiseList ordered>
        {steps.map((step, index) => (
          <li key={step.text}>
            <Card className="ob-card">
              <IconTile icon={step.icon} />
              <div>
                <p className="ob-step__label">{`${MANUAL.step} ${String(index + 1)}`}</p>
                <p className="ob-step__text">{step.text}</p>
              </div>
            </Card>
          </li>
        ))}
      </RiseList>
    </OnboardingScreen>
  );
}
