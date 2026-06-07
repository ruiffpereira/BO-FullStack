import { useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getNotificationsQueryKey,
  useGetNotifications,
} from "../gen/backoffice/hooks/useGetNotifications.js";
import { useMutation } from "@tanstack/react-query";
import fetch from "@kubb/plugin-client/clients/axios";

export type { GetNotificationsQueryKey } from "../gen/backoffice/hooks/useGetNotifications.js";

export interface Notification {
  notificationId: string;
  userId: string;
  type: "booking" | "order";
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export { getNotificationsQueryKey, getNotifications, useGetNotifications };

export function useNotifications(limit = 30, offset = 0) {
  return useGetNotifications(
    { limit, offset },
    { query: { staleTime: 0 } },
  );
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch<unknown, unknown, unknown>({ method: "PATCH", url: `/notifications/${id}/read` }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch<unknown, unknown, unknown>({ method: "PATCH", url: `/notifications/read-all` }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch<unknown, unknown, unknown>({ method: "DELETE", url: `/notifications/${id}` }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: getNotificationsQueryKey() }),
  });
}
