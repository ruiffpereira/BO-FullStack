import { useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getNotificationsQueryKey,
  useGetNotifications,
} from "../gen/backoffice/hooks/useGetNotifications.js";
import { usePatchNotificationsIdRead } from "../gen/backoffice/hooks/usePatchNotificationsIdRead.js";
import { usePatchNotificationsReadAll } from "../gen/backoffice/hooks/usePatchNotificationsReadAll.js";
import { useDeleteNotificationsId } from "../gen/backoffice/hooks/useDeleteNotificationsId.js";
import { useAuth } from "../context/AuthContext";

export type { GetNotificationsQueryKey } from "../gen/backoffice/hooks/useGetNotifications.js";

// Taxonomia unificada (espelha src/utils/notifyUser.ts na API).
export type NotificationType =
  | "booking" | "order" | "customer" | "gym" | "payment" | "stock" | "reminder" | "system";

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export { getNotificationsQueryKey, getNotifications, useGetNotifications };

export function useNotifications(limit = 30, offset = 0) {
  const { authHeader, isAuthenticated } = useAuth();

  return useGetNotifications(
    { limit, offset },
    {
      client: { headers: authHeader() },
      query: { staleTime: 0, enabled: isAuthenticated },
    },
  );
}

export function useMarkRead() {
  const qc = useQueryClient();
  const { authHeader } = useAuth();
  return usePatchNotificationsIdRead({
    client: { headers: authHeader() },
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { authHeader } = useAuth();
  return usePatchNotificationsReadAll({
    client: { headers: authHeader() },
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  const { authHeader } = useAuth();
  return useDeleteNotificationsId({
    client: { headers: authHeader() },
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }) },
  });
}
