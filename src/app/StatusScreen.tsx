import { useTheme } from '@/app/providers/theme-context';
import { Button, Logo } from '@/design-system/ui';

import './StatusScreen.css';

interface StatusScreenProps {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * A whole-screen message: logo, title, one line, one primary button. Used for
 * "Page not found" and "Something went wrong" (master 6.7.1). It is plain on
 * purpose: it must still render when the screen behind it has failed.
 */
export function StatusScreen({ title, text, actionLabel, onAction }: StatusScreenProps) {
  const { resolved } = useTheme();

  return (
    <main className="status-screen">
      <div className="status-screen__inner">
        <Logo scheme={resolved} size="lg" />
        <div className="status-screen__text">
          <h1 className="status-screen__title">{title}</h1>
          <p>{text}</p>
        </div>
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </main>
  );
}
