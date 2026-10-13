import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton, ScreenContainer, ScreenHead } from '@/design-system/ui';

import './Onboarding.css';

interface OnboardingScreenProps {
  title: string;
  description: string;
  /** Sits above the heading: the logo, the transfer picture, the tick. */
  hero?: ReactNode;
  /** The intro's tighter heading, with no extra space around it. */
  tightHead?: boolean;
  onBack?: (() => void) | undefined;
  /** The buttons, set a little apart from the content above. */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * The frame every onboarding screen shares (master 6.2): back button on the
 * bar, a hero, the heading, the content and the footer, in the one column.
 */
export function OnboardingScreen({
  title,
  description,
  hero,
  tightHead = false,
  onBack,
  footer,
  children,
}: OnboardingScreenProps) {
  return (
    <ScreenContainer
      bar={
        onBack ? (
          <IconButton icon={ArrowLeft} label="Back" className="ui-form-screen__back" onClick={onBack} />
        ) : (
          <span aria-hidden="true" />
        )
      }
    >
      <div className="ob-body">
        {hero ? <div className="ui-form-screen__hero">{hero}</div> : null}
        {tightHead ? (
          <ScreenHead className="ob-head" title={title} description={description} />
        ) : (
          <header className="ui-form-screen__head">
            <ScreenHead title={title} description={description} />
          </header>
        )}
        {children}
        {footer ? <div className="ob-foot">{footer}</div> : null}
      </div>
    </ScreenContainer>
  );
}
