import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { newNotePath } from '@/features/notes/newNotePath';

import { useSessionUser } from './useSessionUser';

/** Opens a blank note at once. The pen and every "New note" button use this one function. */
export function useStartNote(): () => void {
  const userId = useSessionUser()?.id ?? null;
  const navigate = useNavigate();

  return useCallback(() => {
    if (userId === null) return;
    void newNotePath(userId).then((to) => navigate(to, { state: { skipEnterAnimation: true } }));
  }, [userId, navigate]);
}
