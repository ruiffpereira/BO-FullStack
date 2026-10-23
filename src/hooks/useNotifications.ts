import { useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getNotificationsQueryKey,
  useGetNotifications,
} from "../gen/backoffice/hooks/useGetNotifications.js";
import { usePatchNotificationsIdRead } from "../gen/backoffice/hooks/usePatchNotificationsIdRead.js";
import { usePatchNotificationsReadAll } from "../gen/backoffice/hooks/usePatchNotificationsReadAll.js";
import { useDeleteNotificationsId } from "../gen/backoffice/hooks/useDeleteNotificationsId.js";
import type { BackofficeNotification } from "../gen/backoffice/types/BackofficeNotification.js";
import { useAuth } from "../context/AuthContext";

export type { GetNotificationsQueryKey } from "../gen/backoffice/hooks/useGetNotifications.js";

// Derivado do gerado; `type` é a taxonomia unificada de `src/utils/notifyUser.ts` na API (booking | order | customer
// | gym | payment | stock | reminder | message | email | system) — o spec declara-a como string.
export type Notification = BackofficeNotification;

export { getNotificationsQueryKey, getNotifications, useGetNotifications };

export function useNotifications(limit = 30, offset = 0) {
  const { isAuthenticated } = useAuth();

  return useGetNotifications(
    { limit, offset },
    {
      query: { staleTime: 0, enabled: isAuthenticated },
    },
  );
}

export function useMarkRead() {
  const qc = useQueryClient();
  return usePatchNotificationsIdRead({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return usePatchNotificationsReadAll({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useDeleteNotificationsId({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}
