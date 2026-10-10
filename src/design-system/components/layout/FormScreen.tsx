import { ChevronLeft } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { ScreenContainer } from './ScreenContainer';

import './FormScreen.css';

interface FormScreenProps {
  title: string;
  description?: string | undefined;
  /** A Logo, shown above the title. */
  logo?: ReactNode;
  onBack?: (() => void) | undefined;
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void) | undefined;
  /** The actions: usually one primary block button and a link. */
  footer?: ReactNode;
  /** The fields. */
  children: ReactNode;
}

/** A centred form screen: head, fields and actions as one group in the 500px column. */
export function FormScreen({ title, description, logo, onBack, onSubmit, footer, children }: FormScreenProps) {
  return (
    <ScreenContainer
      bar={onBack ? <IconButton icon={ChevronLeft} label="Back" className="ui-form-screen__back" onClick={onBack} /> : null}
    >
      <div className="ui-form-screen__head">
        {logo}
        <h1 className="ui-form-screen__title">{title}</h1>
        {description ? <p className="ui-form-screen__description">{description}</p> : null}
      </div>
      <form className="ui-form-screen__body" noValidate onSubmit={onSubmit}>
        <div className="ui-form-screen__fields">{children}</div>
        {footer ? <div className="ui-form-screen__footer">{footer}</div> : null}
      </form>
    </ScreenContainer>
  );
}
