import { Check, Pen, WifiOff } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import { playTypedDemo } from '@/design-system/motion/patterns';
import { Icon, IconTile } from '@/design-system/ui';
import { INTRO } from '@/features/onboarding/onboardingContent';

/**
 * The typed demo: a line is typed, a saved note row drops in under it with
 * "Not synced", and that becomes "Synced". Decorative, so hidden from screen
 * readers; the four cards below say the same in words.
 */
export function IntroDemo() {
  const say = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const notSynced = useRef<HTMLSpanElement>(null);
  const synced = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!say.current || !caret.current || !row.current || !notSynced.current || !synced.current) {
      return undefined;
    }
    return playTypedDemo({
      say: say.current,
      caret: caret.current,
      row: row.current,
      notSynced: notSynced.current,
      synced: synced.current,
      chars: INTRO.demo.length,
    });
  }, []);

  return (
    <div className="ob-demo" aria-hidden="true">
      <div className="ob-say">
        <Icon icon={Pen} />
        <span ref={say} className="ob-say__text">
          {INTRO.demo}
        </span>
        <span ref={caret} className="ob-say__caret" />
      </div>
      <div ref={row} className="ob-row">
        <IconTile icon={Pen} />
        <div className="ob-row__mid">
          <span>{INTRO.demo}</span>
          <small>{INTRO.saved}</small>
        </div>
        <div className="ob-sync">
          <span ref={notSynced} className="ob-sync__a">
            <Icon icon={WifiOff} />
            {INTRO.notSynced}
          </span>
          <span ref={synced} className="ob-sync__b">
            <Icon icon={Check} />
            {INTRO.synced}
          </span>
        </div>
      </div>
    </div>
  );
}
