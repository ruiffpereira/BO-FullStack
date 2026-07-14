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
/**
 * 7 nomeados curados (`[data-accent]` no renderer) OU um hex livre `#rrggbb`
 * (color-picker na tab Marca, `BrandTab` em `Website.tsx`) — validado com
 * `/^#[0-9a-f]{6}$/i`, a MESMA regex do renderer
 * (`site-engine/lib/theme.ts::accentStyle`); qualquer outro valor é inválido
 * e cai no default "blue" na leitura. `(string & {})` mantém o autocomplete
 * dos 7 nomeados sem colapsar o tipo para `string` pura.
 */
export type ThemeAccent =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "teal"
  | "ink"
  | (string & {});
export type ThemeFont = "grotesk" | "editorial" | "modern" | "warm" | "serifbody";
/** Modo claro/escuro do site público (renderer: `lib/theme.ts::themeAttrs`,
 *  fallback "light" quando ausente — sites antigos sem `mode` continuam claros). */
export type ThemeMode = "light" | "dark";

export interface SiteTheme {
  preset?: ThemePreset | null;
  accent?: ThemeAccent | null;
  font?: ThemeFont | null;
  mode?: ThemeMode | null;
  logo?: string | null;
}

/**
 * Link do menu. Por omissão a nav deriva-se de `pages[].inNav` (editada na tab
 * Páginas) — `nav.items` ausente/vazio = automático. Quando presente E
 * não-vazio, é um OVERRIDE MANUAL que GANHA SEMPRE (mesmo havendo páginas com
 * `inNav: true`) — editável na tab "Rodapé & Nav" → "Itens do menu" (toggle
 * Automático/Personalizado, `FooterNavTab` em `Website.tsx`; ver
 * `site-engine/lib/nav.ts::buildNavLinks`). Os nomes de campo espelham o que
 * o renderer lê: `to`, não `href`.
 */
export interface NavItem {
  label?: string;
  to?: string;
  anchor?: string;
}

export interface SiteNav {
  items?: NavItem[];
  /**
   * Botão de destaque do cabeçalho (CTA). `to` (não `href`) — alinhado ao que
   * `resolveNavCta` lê em `site-engine/lib/nav.ts`. `null`/ausente = sem CTA
   * próprio (o renderer cai no default da vertical do template, ou nenhum).
   */
  cta?: { label: string; to: string } | null;
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

/** Link de uma coluna do rodapé — nomes de campo alinhados ao renderer
 *  (`site-engine/components/blocks/Footer.tsx`): `to`, não `href`. */
export interface FooterLink {
  label?: string;
  to?: string;
}

/** Coluna do rodapé: título + lista de links. */
export interface FooterColumn {
  title?: string;
  links?: FooterLink[];
}

export interface SiteFooter {
  name?: string;
  tagline?: string;
  smallPrint?: string;
  columns?: FooterColumn[];
  [key: string]: unknown;
}

// ── Definições (3.10, `.design/site-tenant-light/DESIGN_BRIEF.md`) ──────────
//
// `settings` é um objeto de topo NOVO e inteiramente OPCIONAL do Site JSON —
// o renderer IGNORA chaves desconhecidas (forward-compat) e cada resolver
// tolera undefined/null/malformado em qualquer campo, nunca lançando
// (`site-engine/lib/settings.ts`, READ-ONLY daqui — é o contrato PINADO,
// espelhado 1:1 abaixo). Editado na tab "Definições" (`SettingsTab`,
// `Website.tsx`), tenant-open (sem gate de `VIEW_SITE_BUILDER`/`VIEW_ADMIN`).

/** Texto por língua — mesmo padrão de `block.settings.content[locale]`. */
export type LocalizedText = Record<string, string>;

export interface SiteSettingsAnnouncement {
  enabled: boolean;
  text?: LocalizedText;
  href?: string | null;
}

/** Botão flutuante de WhatsApp — `number` é o texto tal como o tenant o
 *  escreve (o renderer é que reduz a dígitos, `sanitizeWhatsappNumber`). */
export interface SiteSettingsWhatsapp {
  enabled: boolean;
  number?: string;
}

/** URLs completos http(s) — allowlist aplicada pelo renderer na leitura. */
export interface SiteSettingsSocial {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface SiteSettingsVacation {
  enabled: boolean;
  message?: LocalizedText;
}

/** SEO de topo do site — override único (não por página) sobre o que o
 *  renderer já deriva; cada campo é independente. */
export interface SiteSettingsSeo {
  title?: LocalizedText;
  description?: LocalizedText;
  ogImage?: string;
}

/** `data-radius` do `<html>` — ausente/inválido cai em "rounded" (visual atual). */
export type SiteRadius = "rounded" | "square";

export interface SiteSettings {
  announcement?: SiteSettingsAnnouncement;
  whatsapp?: SiteSettingsWhatsapp;
  social?: SiteSettingsSocial;
  vacation?: SiteSettingsVacation;
  seo?: SiteSettingsSeo;
  radius?: SiteRadius;
}

export interface Site {
  siteId: string | null;
  subdomain: string | null;
  /**
   * Domínio próprio do tenant (3.9), quando definido — editado na secção
   * "Domínio próprio" da tab Domínio, via endpoint DEDICADO
   * (`useSetCustomDomain`), NUNCA pelo `PUT /website` (whitelist anti
   * mass-assignment exclui-o de propósito).
   */
  customDomain?: string | null;
  template: string | null;
  defaultLocale: string;
  activeLocales: string[];
  theme: SiteTheme | null;
  nav: SiteNav | null;
  pages: SitePage[];
  footer: SiteFooter | null;
  /** Afinação leve do tenant (3.10) — ver bloco de tipos acima. */
  settings?: SiteSettings | null;
  published: boolean;
  publishedAt: string | null;
}

/** Corpo aceite pelo PUT /website (subconjunto do Site). */
export interface SiteUpsert {
  theme?: SiteTheme | null;
  nav?: SiteNav | null;
  pages?: SitePage[];
  footer?: SiteFooter | null;
  settings?: SiteSettings | null;
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

export interface CustomDomainResult {
  customDomain: string | null;
}

/**
 * PUT /website/custom-domain — define (ou remove, `value: null`) o domínio
 * próprio do tenant (3.9). Endpoint DEDICADO — fora do `PUT /website` de
 * propósito (a whitelist anti mass-assignment exclui `customDomain`; ver
 * DESIGN_BRIEF.md secção 3.9). Respostas: 200 `{ customDomain }` · 400
 * `{ error, reason: "invalid" | "root_domain" }` · 409 quando o domínio já
 * pertence a outro tenant. Ao definir, a API sincroniza também o domínio das
 * Estatísticas (mesma regra do `useSetSubdomain`), por isso invalida também
 * a cache `site-analytics`.
 */
export function useSetCustomDomain() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation<CustomDomainResult, unknown, string | null>({
    mutationFn: async (value) => {
      const res = await axiosInstance.put<CustomDomainResult>(
        "/website/custom-domain",
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
