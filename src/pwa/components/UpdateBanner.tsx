import { useServiceWorkerUpdate } from '@/pwa/useServiceWorkerUpdate';
import { Button } from '@/design-system/components/Button/Button';
import './UpdateBanner.css';

/**
 * 11D's visible half. Deliberately NOT the toast system
 * (`ToastProvider`'s own doc comment: one at a time, auto-dismissing
 * after 8s) — an available update should stay put until acted on, not
 * vanish while someone is mid-sentence in the editor and never notice it
 * again until their next reload finds it anyway.
 *
 * Mounted outside `AuthProvider` in `App.tsx` — an update is offerable
 * whether or not anyone is signed in.
 */
export function UpdateBanner() {
  const { available, applyUpdate } = useServiceWorkerUpdate();

  if (!available) return null;

  return (
    <div className="update-banner" role="status">
      <span className="update-banner__text">A new version of Notare is available.</span>
      <Button variant="primary" size="sm" onClick={applyUpdate}>
        Refresh
      </Button>
    </div>
  );
}
