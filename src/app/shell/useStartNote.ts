/** Opens a new blank note. */
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { newNotePath } from '@/features/notes/newNotePath';

import { useSessionUser } from './useSessionUser';

export function useStartNote(): () => void {
  const userId = useSessionUser()?.id ?? null;
  const navigate = useNavigate();

  return useCallback(() => {
    if (userId === null) return;
    void newNotePath(userId).then((to) => navigate(to, { state: { skipEnterAnimation: true } }));
  }, [userId, navigate]);
}
