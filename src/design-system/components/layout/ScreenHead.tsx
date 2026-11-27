/** A screen's heading and its line under it. */
import './ScreenHead.css';

interface ScreenHeadProps {
  title: string;
  description?: string | undefined;
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
