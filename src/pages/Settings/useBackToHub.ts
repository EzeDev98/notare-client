import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';

/**
 * Back on an inner Settings screen. Inside the app it steps back in history, so
 * the screen slides out the way it came. Opened directly (no history to go back
 * to), it replaces itself with the hub.
 */
export function useBackToHub(fallback: string = ROUTES.settings()): () => void {
  const navigate = useNavigate();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(fallback, { replace: true });
  };
}
