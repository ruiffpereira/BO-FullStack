import { useQuery } from "@tanstack/react-query";
import { getCmsEmailTemplates } from "../gen/backoffice/hooks/useGetCmsEmailTemplates.js";

export interface EmailTemplate {
  key: string;
  label: string;
  placeholders: string[];
  defaultSubject: string;
  defaultBody: string;
  subjectKey: string;
  bodyKey: string;
  permissions: string[];
  /** Values per locale: { pt: { subject, body }, en: { subject, body } } */
  localeValues: Record<string, { subject: string; body: string }>;
}

export interface EmailTemplatesResponse {
  locales: string[];
  defaultLocale: string;
  templates: EmailTemplate[];
}

/**
 * GET /cms/email-templates — migrado (B18) para o client gerado pelo Kubb: a
 * rota ganhou `@swagger` e deixou de precisar do `url`/`baseURL` escritos à
 * mão. O Bearer continua a ser injetado pelo interceptor do `axiosInstance`
 * partilhado (AuthContext.tsx), por isso `authHeader()` deixou de ser preciso.
 */
export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async (): Promise<EmailTemplatesResponse> => await getCmsEmailTemplates(),
    staleTime: 30_000,
  });
}
