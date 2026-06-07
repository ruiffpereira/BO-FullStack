import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

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

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread: number;
}

async function fetchNotifications(
  limit = 30,
  offset = 0,
): Promise<NotificationsResponse> {
  const res = await axiosInstance.get(
    `${BASE}/notifications?limit=${limit}&offset=${offset}`,
  );
  return res.data;
}

async function markRead(id: string): Promise<void> {
  await axiosInstance.patch(`${BASE}/notifications/${id}/read`);
}

async function markAllRead(): Promise<void> {
  await axiosInstance.patch(`${BASE}/notifications/read-all`);
}

async function deleteNotification(id: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/notifications/${id}`);
}

export function useNotifications(limit = 30, offset = 0) {
  return useQuery({
    queryKey: ["notifications", limit, offset],
    queryFn: () => fetchNotifications(limit, offset),
    staleTime: 0,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
