import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import type { GetScheduleCalendar200 } from "../gen/backoffice/types/GetScheduleCalendar.js";
import { getScheduleCalendar } from "../gen/backoffice/hooks/useGetScheduleCalendar.js";
import { postScheduleCalendarRotate } from "../gen/backoffice/hooks/usePostScheduleCalendarRotate.js";

/**
 * Feed de subscrição (.ics) da agenda do tenant. Migrado para os clients
 * gerados pelo Kubb:
 *  GET  /schedule/calendar         → { url, webcalUrl, token } (gera na 1.ª vez)
 *  POST /schedule/calendar/rotate  → roda o token e devolve o novo URL
 * Bearer/baseURL/withCredentials já vêm do interceptor do `axiosInstance`
 * partilhado (AuthContext.tsx) — o client gerado corre nesse mesmo
 * `axiosInstance`, por isso `authHeader()` deixou de ser preciso aqui.
 * `CalendarFeed` = a resposta gerada (os três campos são `required` no spec).
 */
export type CalendarFeed = GetScheduleCalendar200;

const KEY = ["schedule", "calendar"] as const;

export function useScheduleCalendarFeed() {
  const { isAuthenticated } = useAuth();
  return useQuery<CalendarFeed>({
    queryKey: KEY,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    queryFn: () => getScheduleCalendar(),
  });
}

export function useRotateScheduleCalendarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postScheduleCalendarRotate(),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
