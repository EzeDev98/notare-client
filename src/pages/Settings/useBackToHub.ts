/** Back on an inner Settings screen. */
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';

export function useBackToHub(fallback: string = ROUTES.notes()): () => void {
  const navigate = useNavigate();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(fallback, { replace: true });
  };
}
