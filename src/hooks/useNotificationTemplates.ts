import { useQuery } from "@tanstack/react-query";
import { getCmsNotificationTemplates } from "../gen/backoffice/hooks/useGetCmsNotificationTemplates.js";

export interface NotificationTemplate {
  key: string;
  label: string;
  placeholders: string[];
  defaultTitle: string;
  defaultBody: string;
  titleKey: string;
  bodyKey: string;
  permissions: string[];
  /** Values per locale: { pt: { title, body }, en: { title, body } } */
  localeValues: Record<string, { title: string; body: string }>;
}

export interface NotificationTemplatesResponse {
  locales: string[];
  defaultLocale: string;
  templates: NotificationTemplate[];
}

/**
 * GET /cms/notification-templates — migrado (B18) para o client gerado pelo
 * Kubb: a rota ganhou `@swagger` e deixou de precisar do `url`/`baseURL`
 * escritos à mão. O Bearer continua a ser injetado pelo interceptor do
 * `axiosInstance` partilhado (AuthContext.tsx), por isso `authHeader()`
 * deixou de ser preciso.
 */
export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["notification-templates"],
    queryFn: async (): Promise<NotificationTemplatesResponse> => await getCmsNotificationTemplates(),
    staleTime: 30_000,
  });
}
