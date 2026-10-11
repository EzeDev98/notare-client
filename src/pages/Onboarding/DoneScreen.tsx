import { InfoBanner } from '@/design-system/ui';
import { DONE, INSTALLING } from '@/features/onboarding/onboardingContent';

import { SuccessHero } from './OnboardingHero';
import { OnboardingScreen } from './OnboardingScreen';

/** Screen 4. The only exclamation mark in the product. Nothing left to press. */
export function DoneScreen() {
  return (
    <OnboardingScreen hero={<SuccessHero />} title={DONE.title} description={DONE.description}>
      <p className="ob-note">{DONE.offline}</p>
      <InfoBanner>{INSTALLING.tab}</InfoBanner>
      <p className="ob-note">{DONE.close}</p>
    </OnboardingScreen>
  );
}
