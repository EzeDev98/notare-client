/** Onboarding: what Notare is. */
import { ArrowRight } from 'lucide-react';

import { useTheme } from '@/app/providers/theme-context';
import { Button, Card, Icon, IconTile, Logo } from '@/design-system/ui';
import { INTRO } from '@/features/onboarding/onboardingContent';

import { IntroDemo } from './IntroDemo';
import { OnboardingScreen } from './OnboardingScreen';
import { RiseList } from './RiseList';

export function IntroScreen({ onStart }: { onStart: () => void }) {
  const { resolved } = useTheme();

  return (
    <OnboardingScreen
      tightHead
      hero={<Logo scheme={resolved} size="lg" />}
      title={INTRO.title}
      description={INTRO.description}
      footer={
        <Button variant="primary" block onClick={onStart}>
          <span className="ob-go">
            {INTRO.cta}
            <Icon icon={ArrowRight} />
          </span>
        </Button>
      }
    >
      <IntroDemo />
      <RiseList>
        {INTRO.features.map((feature) => (
          <li key={feature.title}>
            <Card className="ob-card">
              <IconTile icon={feature.icon} />
              <div>
                <p className="ob-card__title">{feature.title}</p>
                <p className="ob-card__text">{feature.text}</p>
              </div>
            </Card>
          </li>
        ))}
      </RiseList>
    </OnboardingScreen>
  );
}
