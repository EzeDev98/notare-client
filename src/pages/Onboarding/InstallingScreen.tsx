import { Check, CircleAlert } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { bannerIn, tickIn } from '@/design-system/motion/patterns';
import { Button, Icon, InfoBanner, Spinner, VisuallyHidden } from '@/design-system/ui';
import { INSTALLING } from '@/features/onboarding/onboardingContent';
import { useInstallChecks, type CheckState } from '@/features/onboarding/useInstallChecks';

import { TransferHero } from './OnboardingHero';
import { OnboardingScreen } from './OnboardingScreen';

function CheckRow({ state, label, failed }: { state: CheckState; label: string; failed: string }) {
  const mark = useRef<HTMLSpanElement>(null);

  // The tick or the alert pops in when the answer arrives. A row starts pending, so mounting never plays it.
  useEffect(() => {
    if (state !== 'pending' && mark.current) tickIn(mark.current);
  }, [state]);

  const classes = ['ob-check', state === 'passed' && 'ob-check--done', state === 'failed' && 'ob-check--failed']
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <span ref={mark} className="ob-check__mark">
        {state === 'pending' ? <Spinner size="sm" decorative /> : null}
        {state === 'passed' ? <Icon icon={Check} /> : null}
        {state === 'failed' ? <Icon icon={CircleAlert} /> : null}
      </span>
      <span>
        {state === 'failed' ? failed : label}
        <VisuallyHidden>. {INSTALLING.states[state]}</VisuallyHidden>
      </span>
    </li>
  );
}

function StorageNote() {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (box.current) bannerIn(box.current);
  }, []);
  return (
    <div ref={box}>
      <InfoBanner>{INSTALLING.storage}</InfoBanner>
    </div>
  );
}

/**
 * Screen 3. Three checks that ask the browser, so each line is true when it
 * ticks and says so plainly when it does not (10d). Continue opens once all
 * three have an answer.
 */
export function InstallingScreen({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const { checks, settled, storageRefused } = useInstallChecks();

  return (
    <OnboardingScreen
      hero={<TransferHero />}
      title={INSTALLING.title}
      description={INSTALLING.description}
      onBack={onBack}
      footer={
        <Button variant="primary" block disabled={!settled} onClick={onContinue}>
          {INSTALLING.cta}
        </Button>
      }
    >
      <ul className="ob-list">
        {INSTALLING.checks.map((check) => (
          <CheckRow key={check.key} state={checks[check.key]} label={check.label} failed={check.failed} />
        ))}
      </ul>
      <div>{storageRefused ? <StorageNote /> : null}</div>
      <InfoBanner>{INSTALLING.tab}</InfoBanner>
    </OnboardingScreen>
  );
}
