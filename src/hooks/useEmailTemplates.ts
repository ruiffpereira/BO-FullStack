import fetch from "@kubb/plugin-client/clients/axios";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

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

export function useEmailTemplates() {
  const { authHeader } = useAuth();
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch<EmailTemplatesResponse, Error, unknown>({
        method: "GET",
        url: `/cms/email-templates`,
        baseURL: BASE,
        headers: authHeader(),
      });
      return res.data;
    },
    staleTime: 30_000,
  });
}
