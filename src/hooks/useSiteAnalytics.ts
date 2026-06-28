import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Estatísticas do site público do tenant (Plausible auto-hospedado).
 * Bearer auto-injetado via authHeader(); tudo env-gated no servidor — a API key
 * do Plausible nunca chega ao browser. A API limita a query ao domínio do
 * próprio tenant (isolamento multi-tenant).
 */

// Períodos suportados (alinhados com a Stats API do Plausible).
export type AnalyticsPeriod = "7d" | "30d" | "month" | "6mo";

export interface PlausibleAggregate {
  visitors?: { value: number };
  pageviews?: { value: number };
  bounce_rate?: { value: number };
  visit_duration?: { value: number };
}

export interface PlausibleTimeseriesPoint {
  date: string;
  visitors: number;
}

export interface PlausibleBreakdownRow {
  // event:page → "page"; visit:source → "source"
  page?: string;
  source?: string;
  visitors: number;
}

export interface SiteAnalyticsResponse {
  configured: boolean;
  reason?: "no-plausible" | "no-domain";
  domain?: string;
  period?: string;
  aggregate?: PlausibleAggregate;
  timeseries?: PlausibleTimeseriesPoint[];
  topPages?: PlausibleBreakdownRow[];
  sources?: PlausibleBreakdownRow[];
  error?: string;
}

export interface SiteDomainResponse {
  websiteDomain: string | null;
}

const analyticsKey = (period: AnalyticsPeriod) => ["site-analytics", period];
const DOMAIN_KEY = ["site-analytics", "domain"];

/** GET /analytics/site?period= — estatísticas agregadas + séries + listas. */
export function useSiteAnalytics(period: AnalyticsPeriod) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<SiteAnalyticsResponse>({
    queryKey: analyticsKey(period),
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<SiteAnalyticsResponse>(
        `/analytics/site?period=${encodeURIComponent(period)}`,
        { headers: authHeader(), withCredentials: true },
      );
      return res.data;
    },
  });
}

/** GET /analytics/site/domain — domínio atual do site do tenant. */
export function useSiteDomain() {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<SiteDomainResponse>({
    queryKey: DOMAIN_KEY,
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<SiteDomainResponse>(
        "/analytics/site/domain",
        { headers: authHeader(), withCredentials: true },
      );
      return res.data;
    },
  });
}

/** PUT /analytics/site/domain — guarda o domínio (normalizado no servidor). */
export function useSetSiteDomain() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<SiteDomainResponse, unknown, string>({
    mutationFn: async (domain: string) => {
      const res = await axiosInstance.put<SiteDomainResponse>(
        "/analytics/site/domain",
        { domain },
        { headers: authHeader(), withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOMAIN_KEY });
      qc.invalidateQueries({ queryKey: ["site-analytics"] });
    },
  });
}
