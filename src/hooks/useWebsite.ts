import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Website (site público do tenant, renderizado pelo site-engine à parte).
 * Endpoints manuais (sem Kubb), tipos definidos localmente:
 *   GET  /website                         → Site (ou default vazio)
 *   PUT  /website                         → upsert (theme/nav/pages/footer/…/template)
 *   GET  /website/subdomain/check?value=  → { value, available, reason? }
 *   PUT  /website/subdomain               → { value } → 200 | 400 | 409
 *   POST /website/publish                 → 200 | 400 { error }
 * Bearer auto-injetado via authHeader().
 */

// ── Tipos (espelham o Site da API) ───────────────────────────────────────────

export type ThemePreset = "slate" | "sand" | "ink" | "mist";
export type ThemeAccent = "blue" | "emerald" | "violet" | "amber" | "rose" | "teal" | "ink";
export type ThemeFont = "grotesk" | "editorial" | "modern" | "warm" | "serifbody";

export interface SiteTheme {
  preset?: ThemePreset | null;
  accent?: ThemeAccent | null;
  font?: ThemeFont | null;
  logo?: string | null;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteNav {
  items?: NavItem[];
  cta?: { label: string; href: string } | null;
}

export interface SiteBlock {
  id: string;
  type: string;
  variant?: string;
  contentRef?: string;
  settings?: Record<string, unknown> & {
    content?: Record<string, Record<string, unknown>>;
  };
  data?: Record<string, unknown>;
}

export interface SitePage {
  id: string;
  slug: string;
  /** Título literal (fallback simples; o renderer aceita `title` OU `titleRef`). */
  title?: string;
  titleRef?: string;
  inNav?: boolean;
  order?: number;
  /** "content" (página normal) | "collection" (listagem — roteamento de detalhe é T12). */
  kind?: string;
  seoRef?: string;
  blocks?: SiteBlock[];
}

export interface SiteFooter {
  [key: string]: unknown;
}

export interface Site {
  siteId: string | null;
  subdomain: string | null;
  template: string | null;
  defaultLocale: string;
  activeLocales: string[];
  theme: SiteTheme | null;
  nav: SiteNav | null;
  pages: SitePage[];
  footer: SiteFooter | null;
  published: boolean;
  publishedAt: string | null;
}

/** Corpo aceite pelo PUT /website (subconjunto do Site). */
export interface SiteUpsert {
  theme?: SiteTheme | null;
  nav?: SiteNav | null;
  pages?: SitePage[];
  footer?: SiteFooter | null;
  defaultLocale?: string;
  activeLocales?: string[];
  template?: string | null;
}

export interface SubdomainCheck {
  value: string;
  available: boolean;
  reason?: "reserved" | "too_short" | "taken" | "invalid";
}

export const websiteKeys = {
  all: ["website"] as const,
  site: ["website", "site"] as const,
};

// ── Queries / Mutations ──────────────────────────────────────────────────────

/** GET /website — o Site do tenant (ou o default vazio devolvido pela API). */
export function useSite() {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<Site>({
    queryKey: websiteKeys.site,
    enabled: isAuthenticated,
    staleTime: 0,
    queryFn: async () => {
      const res = await axiosInstance.get<Site>("/website", {
        headers: authHeader(),
      });
      return res.data;
    },
  });
}

/** PUT /website — upsert do Site (só campos editáveis). Invalida a query. */
export function useSaveSite() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<Site, unknown, SiteUpsert>({
    mutationFn: async (input) => {
      const res = await axiosInstance.put<Site>("/website", input, {
        headers: authHeader(),
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.site }),
  });
}

/**
 * Verifica a disponibilidade de um subdomínio (GET /website/subdomain/check).
 * Devolve uma função — o debounce fica a cargo do componente.
 */
export function useCheckSubdomain() {
  const { authHeader } = useAuth();
  return async (value: string): Promise<SubdomainCheck> => {
    const res = await axiosInstance.get<SubdomainCheck>("/website/subdomain/check", {
      headers: authHeader(),
      params: { value },
    });
    return res.data;
  };
}

/** PUT /website/subdomain — reclama um subdomínio. Invalida a query.
 *  A API sincroniza também o domínio das Estatísticas (User.websiteDomain),
 *  por isso invalida-se a cache do site-analytics. */
export function useSetSubdomain() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<Site, unknown, string>({
    mutationFn: async (value) => {
      const res = await axiosInstance.put<Site>(
        "/website/subdomain",
        { value },
        { headers: authHeader() },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: websiteKeys.site });
      qc.invalidateQueries({ queryKey: ["site-analytics"] });
    },
  });
}

/** POST /website/publish — publica o site. Invalida a query. */
export function usePublishSite() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<Site, unknown, void>({
    mutationFn: async () => {
      const res = await axiosInstance.post<Site>(
        "/website/publish",
        {},
        { headers: authHeader() },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.site }),
  });
}
