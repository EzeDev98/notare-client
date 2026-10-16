import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { useToast } from '@/design-system/ui';
import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { refreshPeople } from '@/features/collaboration/refreshPeople';
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

/** What each button in the notifications modal does. `busyId` is the row working right now. */
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

    accept: (n: NotificationResponse, name: string) =>
      work(n, async () => {
        await collaborationService.acceptCollaboration(n.targetId);
        await finish(n);
        toast(C.toasts.connected(name), { tone: 'success' });
        void refreshPeople().catch(() => undefined);
      }),

    decline: (n: NotificationResponse) =>
      work(n, async () => {
        await collaborationService.rejectCollaboration(n.targetId);
        await finish(n);
        toast(C.toasts.declined);
      }),

    open: (n: NotificationResponse) =>
      work(n, async () => {
        if (n.type === 'NOTE_SHARED' || n.type === 'NOTE_SHARE_PERMISSION_CHANGED') {
          await notificationService.markRead(n.id);
          void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          onClose();
          void navigate(ROUTES.note(n.targetId));
          return;
        }
        const clip = await clipRepository.findByServerId(n.targetId);
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
        await transcriptionService.submitTranscription(n.targetId);
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
