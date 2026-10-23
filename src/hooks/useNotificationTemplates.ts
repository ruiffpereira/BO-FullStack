import { useQuery } from "@tanstack/react-query";
import { getCmsNotificationTemplates } from "../gen/backoffice/hooks/useGetCmsNotificationTemplates.js";
import type { GetCmsNotificationTemplates200 } from "../gen/backoffice/types/GetCmsNotificationTemplates.js";
import { queryKeys } from '../lib/queryKeys'

// Derivados do gerado (nunca à mão).
export type NotificationTemplatesResponse = GetCmsNotificationTemplates200;
export type NotificationTemplate = NotificationTemplatesResponse["templates"][number];

/**
 * GET /cms/notification-templates — migrado (B18) para o client gerado pelo
 * Kubb: a rota ganhou `@swagger` e deixou de precisar do `url`/`baseURL`
 * escritos à mão. O Bearer continua a ser injetado pelo interceptor do
 * `axiosInstance` partilhado (AuthContext.tsx), por isso `authHeader()`
 * deixou de ser preciso.
 */
export function useNotificationTemplates() {
  return useQuery({
    queryKey: queryKeys.notificationTemplates,
    queryFn: async (): Promise<NotificationTemplatesResponse> => await getCmsNotificationTemplates(),
    staleTime: 30_000,
  });
}
