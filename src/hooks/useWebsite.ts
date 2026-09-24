import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getWebsite } from "../gen/backoffice/hooks/useGetWebsite.js";
import { putWebsite } from "../gen/backoffice/hooks/usePutWebsite.js";
import { getWebsiteSubdomainCheck } from "../gen/backoffice/hooks/useGetWebsiteSubdomainCheck.js";
import { putWebsiteSubdomain } from "../gen/backoffice/hooks/usePutWebsiteSubdomain.js";
import { putWebsiteCustomDomain } from "../gen/backoffice/hooks/usePutWebsiteCustomDomain.js";
import { postWebsitePublish } from "../gen/backoffice/hooks/usePostWebsitePublish.js";

/**
 * Website (site público do tenant, renderizado pelo site-engine à parte).
 * Migrado (B18) para os clients gerados pelo Kubb:
 *   GET  /website                         → Site (ou default vazio)
 *   PUT  /website                         → upsert (theme/nav/pages/footer/…/template)
 *   GET  /website/subdomain/check?value=  → { value, available, reason? }
 *   PUT  /website/subdomain               → { value } → 200 | 400 | 409
 *   PUT  /website/custom-domain           → { value } → 200 | 400 | 409
 *   POST /website/publish                 → 200 | 400 { error }
 * Bearer auto-injetado pelo interceptor do axiosInstance partilhado (ver
 * AuthContext.tsx) — o client gerado corre nesse mesmo axiosInstance.
 *
 * Os casts `as Site` CAÍRAM (2026-09-24, B20). O schema gerado passou a
 * descrever `theme`/`nav`/`pages`/`footer` com a forma real, e o que faltava
 * no fim era uma linha: `additionalProperties: true` nos mapas livres
 * (`settings`, `data`, `footer`). Sem ela o OpenAPI gera o tipo OPACO `object`,
 * que não é atribuível a `Record<string, unknown>` — e era só isso que obrigava
 * a um cast em todo o `Site`.
 * `settings` **não existe** no schema gerado (nem na API — ver nota grande
 * mais abaixo, é lacuna de produto deliberada, não mexer).
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
export type ThemeFont = "grotesk" | "editorial" | "modern" | "warm" | "serifbody" | "plusjakarta" | "standpair";
/** Modo claro/escuro do site público (renderer: `lib/theme.ts::themeAttrs`,
 *  fallback "light" quando ausente — sites antigos sem `mode` continuam claros). */
export type ThemeMode = "light" | "dark";

export interface SiteTheme {
  preset?: ThemePreset | null;
  accent?: ThemeAccent | null;
  font?: ThemeFont | null;
  mode?: ThemeMode | null;
  // Sem `logo`: o logótipo do site vem do CMS (campo `logo` do bloco hero,
  // editável em Conteúdos), nunca do tema — removido do editor de Marca 2026-08-12.
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
  /** Skin variante de bloco (ex.: "tifas") — define a aparência visual global. */
  skin?: string | null;
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
  skin?: string | null;
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
  const { isAuthenticated } = useAuth();
  return useQuery<Site>({
    queryKey: websiteKeys.site,
    enabled: isAuthenticated,
    staleTime: 0,
    queryFn: async () => (await getWebsite()),
  });
}

/** PUT /website — upsert do Site (só campos editáveis). Invalida a query. */
export function useSaveSite() {
  const qc = useQueryClient();
  return useMutation<Site, unknown, SiteUpsert>({
    mutationFn: async (input) => (await putWebsite(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.site }),
  });
}

/**
 * Verifica a disponibilidade de um subdomínio (GET /website/subdomain/check).
 * Devolve uma função — o debounce fica a cargo do componente.
 */
export function useCheckSubdomain() {
  return async (value: string): Promise<SubdomainCheck> => {
    const data = await getWebsiteSubdomainCheck({ value });
    return data as SubdomainCheck;
  };
}

/** PUT /website/subdomain — reclama um subdomínio. Invalida a query.
 *  A API sincroniza também o domínio das Estatísticas (User.websiteDomain),
 *  por isso invalida-se a cache do site-analytics. */
export function useSetSubdomain() {
  const qc = useQueryClient();
  return useMutation<Site, unknown, string>({
    mutationFn: async (value) => (await putWebsiteSubdomain({ value })),
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
  const qc = useQueryClient();
  return useMutation<CustomDomainResult, unknown, string | null>({
    mutationFn: async (value) => (await putWebsiteCustomDomain({ value })) as CustomDomainResult,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: websiteKeys.site });
      qc.invalidateQueries({ queryKey: ["site-analytics"] });
    },
  });
}

/** POST /website/publish — publica o site. Invalida a query. */
export function usePublishSite() {
  const qc = useQueryClient();
  return useMutation<Site, unknown, void>({
    mutationFn: async () => (await postWebsitePublish()),
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteKeys.site }),
  });
}
