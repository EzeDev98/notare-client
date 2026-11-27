/** Layout for a form screen. */
import { ArrowLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { ScreenContainer } from './ScreenContainer';
import { ScreenHead } from './ScreenHead';

import './FormScreen.css';

interface FormScreenProps {
  title: string;
  description?: string | undefined;
  hero?: ReactNode;
  step?: ReactNode;
  variant?: 'code' | undefined;
  onBack?: (() => void) | undefined;
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void) | undefined;
  footer?: ReactNode;
  children: ReactNode;
}

export function FormScreen({
  title,
  description,
  hero,
  step,
  variant,
  onBack,
  onSubmit,
  footer,
  children,
}: FormScreenProps) {
  return (
    <ScreenContainer
      className={variant === 'code' ? 'ui-form-screen ui-form-screen--code' : 'ui-form-screen'}
      bar={onBack ? <IconButton icon={ArrowLeft} label="Back" className="ui-form-screen__back" onClick={onBack} /> : null}
    >
      {hero ? <div className="ui-form-screen__hero">{hero}</div> : null}
      {step}
      <header className="ui-form-screen__head">
        <ScreenHead title={title} description={description} />
      </header>
      <form className="ui-form-screen__body" noValidate onSubmit={onSubmit}>
        <div className="ui-form-screen__fields">{children}</div>
        {footer ? <div className="ui-form-screen__footer">{footer}</div> : null}
      </form>
    </ScreenContainer>
  );
}
