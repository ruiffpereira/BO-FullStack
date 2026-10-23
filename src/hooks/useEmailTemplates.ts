import { useQuery } from "@tanstack/react-query";
import { getCmsEmailTemplates } from "../gen/backoffice/hooks/useGetCmsEmailTemplates.js";
import type { GetCmsEmailTemplates200 } from "../gen/backoffice/types/GetCmsEmailTemplates.js";
import { queryKeys } from '../lib/queryKeys'

// Derivados do gerado (nunca à mão).
export type EmailTemplatesResponse = GetCmsEmailTemplates200;
export type EmailTemplate = EmailTemplatesResponse["templates"][number];

/**
 * GET /cms/email-templates — migrado (B18) para o client gerado pelo Kubb: a
 * rota ganhou `@swagger` e deixou de precisar do `url`/`baseURL` escritos à
 * mão. O Bearer continua a ser injetado pelo interceptor do `axiosInstance`
 * partilhado (AuthContext.tsx), por isso `authHeader()` deixou de ser preciso.
 */
export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates,
    queryFn: async (): Promise<EmailTemplatesResponse> => await getCmsEmailTemplates(),
    staleTime: 30_000,
  });
}
