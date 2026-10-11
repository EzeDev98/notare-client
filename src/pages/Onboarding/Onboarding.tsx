import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { done } from '@/design-system/motion/motion';
import { screenIn, screenOut, type Direction } from '@/design-system/motion/patterns';

import '@/app/AnimatedRoutes.css';

import { BrowserScreen } from './BrowserScreen';
import { DoneScreen } from './DoneScreen';
import { InstallScreen } from './InstallScreen';
import { InstallingScreen } from './InstallingScreen';
import { IntroScreen } from './IntroScreen';
import { ManualScreen } from './ManualScreen';

type Step = 'intro' | 'install' | 'installing' | 'done' | 'manual' | 'browser';

/** Where Back goes. The intro and the last screen have no Back. */
const BACK: Partial<Record<Step, Step>> = { installing: 'install', manual: 'install', browser: 'install' };

/** Focus follows the screen, to its heading, so a screen reader announces where it landed. */
function focusHeading(stage: HTMLElement): void {
  const heading = stage.querySelector<HTMLElement>('h1');
  if (!heading || stage.contains(document.activeElement)) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/**
 * The five onboarding screens (master 6.2), shown while the app is not
 * installed. They are steps of one gate, not routes: start-up shows this in
 * place of the router and swaps it for the app the moment the app is installed.
 *
 * Screen changes use the same slide as the router (screenOut, then screenIn):
 * forward slides left, Back slides right.
 */
export function OnboardingPage({ onContinueInBrowser }: { onContinueInBrowser: () => Promise<void> }) {
  const stage = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>('intro');
  const shown = useRef<Step>('intro');
  const direction = useRef<Direction>(1);
  const moving = useRef(false);

  const go = useCallback(async (next: Step, dir: Direction): Promise<void> => {
    if (moving.current) return;
    moving.current = true;
    direction.current = dir;
    if (stage.current) await done(screenOut(stage.current, dir));
    setStep(next);
  }, []);

  // The new screen is in the page but not yet painted: drop the exit, play the entrance.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || shown.current === step) return;
    shown.current = step;
    el.getAnimations().forEach((a) => {
      a.cancel();
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
    focusHeading(el);
    void done(screenIn(el, direction.current)).then(() => {
      moving.current = false;
    });
  }, [step]);

  const back = BACK[step];
  const goBack = back ? () => void go(back, -1) : undefined;

  return (
    <main ref={stage} className="route-stage">
      {step === 'intro' ? <IntroScreen onStart={() => void go('install', 1)} /> : null}
      {step === 'install' ? (
        <InstallScreen
          onInstalled={() => void go('installing', 1)}
          onManual={() => void go('manual', 1)}
          onBrowser={() => void go('browser', 1)}
        />
      ) : null}
      {step === 'installing' && goBack ? (
        <InstallingScreen onBack={goBack} onContinue={() => void go('done', 1)} />
      ) : null}
      {step === 'done' ? <DoneScreen /> : null}
      {step === 'manual' && goBack ? <ManualScreen onBack={goBack} /> : null}
      {step === 'browser' && goBack ? (
        <BrowserScreen
          onBack={goBack}
          onInstalled={() => void go('installing', 1)}
          onManual={() => void go('manual', 1)}
          onContinue={onContinueInBrowser}
        />
      ) : null}
    </main>
  );
}
