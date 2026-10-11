import './ScreenHead.css';

interface ScreenHeadProps {
  title: string;
  description?: string | undefined;
}

/**
 * The title and description at the top of a screen, centred. The one place this
 * heading is styled: FormScreen and Welcome both use it.
 */
export function ScreenHead({ title, description }: ScreenHeadProps) {
  return (
    <div className="ui-screen-head">
      <h1 className="ui-screen-head__title">{title}</h1>
      {description ? <p className="ui-screen-head__description">{description}</p> : null}
    </div>
  );
}
