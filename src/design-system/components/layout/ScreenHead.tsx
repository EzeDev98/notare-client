import './ScreenHead.css';

interface ScreenHeadProps {
  title: string;
  description?: string | undefined;
  /** For a screen that needs the heading tighter or wider than the default. */
  className?: string | undefined;
}

export function ScreenHead({ title, description, className }: ScreenHeadProps) {
  return (
    <div className={className ? `ui-screen-head ${className}` : 'ui-screen-head'}>
      <h1 className="ui-screen-head__title">{title}</h1>
      {description ? <p className="ui-screen-head__description">{description}</p> : null}
    </div>
  );
}
