/** What each button in the notifications modal does. */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { useToast } from '@/design-system/ui';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { notificationService } from '@/features/notifications/api/notificationService';
import { NOTIFICATION_COPY as C } from '@/features/notifications/notificationContent';
import { notificationKeys } from '@/features/notifications/hooks/useNotifications';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks/useNotificationMutations';
import type { NotificationResponse } from '@/features/notifications/types';
import { transcriptionService } from '@/features/voice/api/transcriptionService';

function targetIdOf(n: NotificationResponse): number {
  if (n.targetId === null) throw new Error('Notification has no target');
  return n.targetId;
}

export function useNotificationActions(onClose: () => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const remove = useDeleteNotification();
  const markAll = useMarkAllNotificationsRead();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function work(n: NotificationResponse, run: () => Promise<void>): Promise<void> {
    setBusyId(n.id);
    try {
      await run();
    } catch {
      toast(C.toasts.failed, { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  const finish = (n: NotificationResponse) =>
    notificationService
      .deleteNotification(n.id)
      .then(() => queryClient.invalidateQueries({ queryKey: notificationKeys.all }));

  return {
    busyId,

    open: (n: NotificationResponse) =>
      work(n, async () => {
        const clip = await clipRepository.findByServerId(targetIdOf(n));
        const note = clip ? await noteRepository.getByLocalId(clip.noteId) : undefined;
        if (!note) {
          toast(C.toasts.gone);
          return;
        }
        await notificationService.markRead(n.id);
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        onClose();
        void navigate(ROUTES.legacy.noteOf(note));
      }),

    retry: (n: NotificationResponse) =>
      work(n, async () => {
        await transcriptionService.submitTranscription(targetIdOf(n));
        await finish(n);
        toast(C.toasts.transcribing);
      }),

    dismiss: (n: NotificationResponse) => {
      remove.mutate(n.id);
    },

    markAll: () => {
      markAll.mutate();
    },
    markingAll: markAll.isPending,
  };
}
