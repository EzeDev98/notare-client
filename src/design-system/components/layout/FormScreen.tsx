import { ArrowLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { ScreenContainer } from './ScreenContainer';
import { ScreenHead } from './ScreenHead';

import './FormScreen.css';

interface FormScreenProps {
  title: string;
  description?: string | undefined;
  /** A centred icon above the head (Check email). */
  hero?: ReactNode;
  /** A Steps indicator, full column width, above the head. */
  step?: ReactNode;
  /** code: the one-time-code screen; its form is centred and only as wide as the boxes. */
  variant?: 'code' | undefined;
  onBack?: (() => void) | undefined;
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void) | undefined;
  /** The actions: usually one primary block button and a link. */
  footer?: ReactNode;
  /** The fields. */
  children: ReactNode;
}

/** A centred form screen: head, fields and actions as one group in the 500px column. */
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
