/** Layout shared by the onboarding screens. */
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton, ScreenContainer, ScreenHead } from '@/design-system/ui';

import './Onboarding.css';

interface OnboardingScreenProps {
  title: string;
  description: string;
  hero?: ReactNode;
  tightHead?: boolean;
  onBack?: (() => void) | undefined;
  footer?: ReactNode;
  children?: ReactNode;
}

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
