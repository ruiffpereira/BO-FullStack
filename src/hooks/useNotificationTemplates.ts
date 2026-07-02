import fetch from "@kubb/plugin-client/clients/axios";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

import { API_BASE as BASE } from "../lib/env";

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

export function useNotificationTemplates() {
  const { authHeader } = useAuth();
  return useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const res = await fetch<NotificationTemplatesResponse, Error, unknown>({
        method: "GET",
        url: `/cms/notification-templates`,
        baseURL: BASE,
        headers: authHeader(),
      });
      return res.data;
    },
    staleTime: 30_000,
  });
}
