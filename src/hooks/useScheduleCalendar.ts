import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Feed de subscrição (.ics) da agenda do tenant. Endpoints manuais (sem Kubb):
 *  GET  /schedule/calendar         → { url, webcalUrl, token } (gera na 1.ª vez)
 *  POST /schedule/calendar/rotate  → roda o token e devolve o novo URL
 */
export interface CalendarFeed {
  token: string;
  url: string;
  webcalUrl: string;
}

const KEY = ["schedule", "calendar"] as const;

export function useScheduleCalendarFeed() {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<CalendarFeed>({
    queryKey: KEY,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await axiosInstance.get<CalendarFeed>("/schedule/calendar", {
        headers: authHeader(),
      });
      return res.data;
    },
  });
}

export function useRotateScheduleCalendarToken() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post<CalendarFeed>(
        "/schedule/calendar/rotate",
        {},
        { headers: authHeader() },
      );
      return res.data;
    },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
