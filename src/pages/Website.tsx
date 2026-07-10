import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  Button,
  IconButton,
  Badge,
  Input,
  Toggle,
  PageHeader,
  SectionTitle,
} from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { usePageSubtitle } from "../context/PageMetaContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FileUpload } from "../components/FileUpload";
import { PageBlocksSection } from "../components/website/PageBlocksSection";
import { uploadImage } from "../gen/backoffice/hooks/useUploadImage.js";
import { SITE_ROOT_URL } from "../lib/env";
import {
  useSite,
  useSaveSite,
  useCheckSubdomain,
  useSetSubdomain,
  usePublishSite,
  type Site,
  type SitePage,
  type SiteTheme,
  type SiteNav,
  type NavItem,
  type SiteFooter,
  type FooterColumn,
  type SiteUpsert,
  type ThemePreset,
  type ThemeAccent,
  type ThemeFont,
  type ThemeMode,
  type SubdomainCheck,
} from "../hooks/useWebsite";
import {
  ACCENT_HEX,
  ACCENT_LABEL,
  PRESET_LABEL,
  FONT_LABEL,
  FONT_STACK,
  MODE_LABEL,
  MODE_ICON,
  THEME_PRESETS,
  THEME_ACCENTS,
  THEME_FONTS,
  THEME_MODES,
  PRESET_BG,
  PRESET_FG,
  isNamedAccent,
  normalizeAccentHex,
  resolveAccentHex,
} from "../lib/themeOptions";
import { useGetWebsiteTemplates } from "../gen/backoffice/hooks/useGetWebsiteTemplates";
import type { SiteTemplate } from "../gen/backoffice/types/SiteTemplate";
import { usePostWebsitePreviewToken } from "../gen/backoffice/hooks/usePostWebsitePreviewToken";

/**
 * "Website" — área self-serve onde o tenant configura o site público
 * (renderizado pelo site-engine à parte). Cada separador vive na sua própria
 * rota (`/website`, `/website/template`, `/website/paginas`, `/website/marca`,
 * `/website/rodape-nav`, `/website/dominio` — T2.3, Fase 2 da sidebar com
 * submenus) — a navegação entre vistas já não é feita por `Tabs` de topo, é a
 * sidebar (`NavItemGroup`/`Shell.tsx`); a página só recebe a vista pedida via
 * `view`. A página nunca usou `?tab=` (sem redirect de deep-link legacy a
 * fazer aqui, ao contrário de Loja/Clientes/Financeiro).
 *
 * Vistas: O meu site (estado + publicar), Template (galeria de arranque),
 * Páginas (gestor de páginas — título/slug/nav/tipo, T23), Marca
 * (preset/accent/fonte/logo) e Domínio (subdomínio com verificação). O editor
 * de blocos vive dentro da vista Páginas.
 *
 * Env (OBRIGATÓRIA, sem default — erro se faltar, em qualquer ambiente):
 *   VITE_SITE_ROOT_URL — base pública dos sites dos tenants
 *                        (prod: https://rufvision.com · dev: http://localhost:3000)
 * Validada no vite.config.ts (falha o build) + em src/lib/env.ts (backstop).
 */

/**
 * Base pública onde vivem os sites dos tenants. O site de cada tenant é
 * `{subdomain}.{host desta base}`.
 */
function siteRoot(): URL {
  return new URL(SITE_ROOT_URL);
}

export type WebsiteView = "site" | "template" | "pages" | "brand" | "footer" | "domain";

/** URL público mostrado ao tenant ({subdomain}.{host da base}). */
function siteUrl(subdomain: string | null): string {
  return subdomain ? `${subdomain}.${siteRoot().host}` : "";
}

/** Link "Ver site" — {protocol}//{subdomain}.{host} (dev: http://x.localhost:3000). */
function siteHref(subdomain: string | null): string {
  const u = siteRoot();
  return subdomain ? `${u.protocol}//${subdomain}.${u.host}` : u.origin;
}

// ── Checklist de setup ────────────────────────────────────────────────────────

interface SetupStep {
  key: string;
  label: string;
  done: boolean;
}

/**
 * A página inicial (home = slug vazio, `isHomePage`) tem de ter pelo menos um
 * bloco antes de publicar — senão o site fica no ar com a home em branco.
 * Se por alguma razão não houver uma home identificável (ex.: nenhuma página
 * com slug vazio), cai para a regra mais permissiva: pelo menos UMA página
 * qualquer com blocos.
 */
function homeHasContent(site: Site | undefined): boolean {
  const pages = site?.pages ?? [];
  const home = pages.find(isHomePage);
  if (home) return (home.blocks?.length ?? 0) >= 1;
  return pages.some((p) => (p.blocks?.length ?? 0) >= 1);
}

function setupSteps(site: Site | undefined): SetupStep[] {
  return [
    { key: "template", label: "Escolher um template", done: !!site?.template },
    {
      key: "brand",
      label: "Definir a marca (cor de destaque)",
      done: !!site?.theme?.accent,
    },
    { key: "subdomain", label: "Reclamar um subdomínio", done: !!site?.subdomain },
    {
      key: "pages",
      label: "Ter pelo menos uma página",
      done: (site?.pages?.length ?? 0) >= 1,
    },
    {
      key: "home-content",
      label: "Adiciona conteúdo à página inicial",
      done: homeHasContent(site),
    },
  ];
}

// ── Tab: O meu site ───────────────────────────────────────────────────────────

function SiteStatusTab({ site, siteUpdatedAt }: { site: Site; siteUpdatedAt: number }) {
  const publish = usePublishSite();
  const steps = setupSteps(site);
  const pending = steps.filter((s) => !s.done);
  const canPublish = pending.length === 0;
  const url = siteUrl(site.subdomain);

  const publishReason = !site.template
    ? "Escolhe um template primeiro."
    : !site.subdomain
      ? "Reclama um subdomínio primeiro."
      : (site.pages?.length ?? 0) < 1
        ? "O site precisa de pelo menos uma página."
        : !homeHasContent(site)
          ? "Adiciona pelo menos um bloco à página inicial."
          : !site.theme?.accent
            ? "Define a cor de destaque da marca."
            : "";

  const onPublish = () => {
    publish.mutate(undefined, {
      onSuccess: () => toast.success("Site publicado."),
      onError: (err: any) => {
        const code = err?.response?.data?.error;
        const msg =
          code === "no_subdomain"
            ? "Falta o subdomínio."
            : code === "no_pages"
              ? "O site não tem páginas."
              : code === "no_site"
                ? "Ainda não há site — escolhe um template."
                : "Não foi possível publicar.";
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Estado + URL */}
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle className="mb-0">Estado</SectionTitle>
          {site.published ? (
            <Badge tone="green" dot>
              Publicado
            </Badge>
          ) : (
            <Badge tone="amber" dot>
              Rascunho
            </Badge>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-4">
          <p className="text-[13px] text-zinc-500">Endereço do site</p>
          {url ? (
            <div className="mt-1 flex items-center justify-between gap-3 flex-wrap">
              <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100 break-all">
                {url}
              </span>
              <a
                href={siteHref(site.subdomain)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Icon name="eye" className="w-4 h-4" />
                Ver site
              </a>
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">
              Ainda sem endereço — reclama um subdomínio na tab Domínio.
            </p>
          )}
        </div>

        <div className="mt-5">
          <Button
            onClick={onPublish}
            disabled={!canPublish}
            isLoading={publish.isPending}
            icon="upload"
            title={canPublish ? undefined : publishReason}
          >
            {site.published ? "Republicar" : "Publicar"}
          </Button>
          {!canPublish && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {publishReason}
            </p>
          )}
        </div>
      </Card>

      {/* Checklist */}
      <Card className="p-5">
        <SectionTitle
          right={
            pending.length > 0 ? (
              <Badge tone="amber">{pending.length} por fazer</Badge>
            ) : (
              <Badge tone="green">Completo</Badge>
            )
          }
        >
          Setup pendente
        </SectionTitle>
        <ul className="mt-3 space-y-2.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 text-sm">
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  s.done
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                }`}
              >
                {s.done ? (
                  <Icon name="check" className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={
                  s.done
                    ? "text-zinc-400 line-through"
                    : "text-zinc-700 dark:text-zinc-200"
                }
              >
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>

    <PreviewPanel refreshKey={siteUpdatedAt} />
    </div>
  );
}

/**
 * Pré-visualização ao vivo do rascunho — <iframe> do renderer alimentado por
 * um token de preview de curta duração (30 min, mintado sob pedido). Remint
 * automaticamente ao montar e sempre que `refreshKey` muda (= qualquer save
 * bem sucedido nesta página, ver `Website()`/`useSite().dataUpdatedAt`) para
 * o tenant ver as alterações sem sair da tab. O botão "Abrir em nova aba" é
 * o fallback garantido — funciona mesmo que a framing seja bloqueada (CSP
 * `frame-ancestors` no renderer só permite origens explicitamente
 * configuradas; ver `site-engine/middleware.ts`).
 */
function PreviewPanel({ refreshKey }: { refreshKey: number }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [iframeNonce, setIframeNonce] = useState(0);
  const [mintError, setMintError] = useState(false);
  const firstRefreshKey = useRef(refreshKey);

  const mint = usePostWebsitePreviewToken({
    mutation: {
      onSuccess: (data) => {
        // A API devolve `url` já pronto quando o RENDERER_URL está
        // configurado no servidor. Sem isso, construímos a partir do
        // SITE_ROOT_URL do próprio Backoffice — o renderer serve /preview
        // no MESMO host/porta que serve os sites publicados por subdomínio
        // (é uma rota, não depende do Host), por isso a origem do
        // SITE_ROOT_URL é sempre um fallback válido, sem precisar de env
        // nova aqui.
        const token = data?.token;
        const url = data?.url ?? (token ? `${siteRoot().origin}/preview?token=${encodeURIComponent(token)}` : null);
        if (!url) {
          setMintError(true);
          setPreviewUrl(null);
          return;
        }
        setMintError(false);
        setPreviewUrl(url);
        setIframeNonce((n) => n + 1);
      },
      onError: () => {
        setMintError(true);
        setPreviewUrl(null);
      },
    },
  });

  // Mint on mount.
  useEffect(() => {
    mint.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-mint whenever the site changes elsewhere on the page (any save).
  useEffect(() => {
    if (refreshKey === firstRefreshKey.current) return;
    firstRefreshKey.current = refreshKey;
    mint.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const retry = () => mint.mutate();

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <IconButton
              icon="loader"
              label="Atualizar pré-visualização"
              onClick={retry}
              className={mint.isPending ? "animate-spin" : ""}
            />
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Icon name="eye" className="w-4 h-4" />
                Abrir em nova aba
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-400 opacity-50 pointer-events-none"
              >
                <Icon name="eye" className="w-4 h-4" />
                Abrir em nova aba
              </span>
            )}
          </div>
        }
      >
        Pré-visualização
      </SectionTitle>

      {mintError && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 p-4 text-sm flex items-start gap-3">
          <Icon name="alertTriangle" className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Não foi possível gerar a pré-visualização.</p>
            <p className="text-zinc-500 mt-0.5">Tenta novamente daqui a pouco.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={retry} isLoading={mint.isPending}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {!mintError && (
        <>
          {previewUrl ? (
            <iframe
              key={iframeNonce}
              src={previewUrl}
              title="Pré-visualização do site"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white"
              style={{ height: 560 }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="h-[560px] rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          )}
          <p className="text-xs text-zinc-400 mt-2">
            Se a pré-visualização não aparecer aqui, usa "Abrir em nova aba".
          </p>
        </>
      )}
    </Card>
  );
}

// ── Tab: Template ─────────────────────────────────────────────────────────────

/** Aproximação de cor (fundo/texto/destaque) a partir do preset+accent do
 *  template — a API não devolve uma miniatura própria, só o `site.theme`. */
function ThumbPreview({ template }: { template: SiteTemplate }) {
  const theme = (template.site?.theme ?? null) as {
    preset?: string | null;
    accent?: string | null;
  } | null;
  const preset = (theme?.preset as keyof typeof PRESET_BG) ?? "slate";
  const accentKey = (theme?.accent as keyof typeof ACCENT_HEX) ?? "blue";
  const bg = PRESET_BG[preset] ?? PRESET_BG.slate;
  const fg = PRESET_FG[preset] ?? PRESET_FG.slate;
  const accent = ACCENT_HEX[accentKey] ?? ACCENT_HEX.blue;
  return (
    <div
      className="h-28 rounded-lg overflow-hidden flex flex-col justify-between p-3"
      style={{ background: bg, color: fg }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: accent }}
        />
        <span className="w-8 h-1.5 rounded-full" style={{ background: fg, opacity: 0.5 }} />
        <span className="ml-auto w-6 h-1.5 rounded-full" style={{ background: fg, opacity: 0.25 }} />
      </div>
      <div>
        <div className="w-2/3 h-2 rounded-full mb-1.5" style={{ background: fg, opacity: 0.85 }} />
        <div className="w-1/2 h-1.5 rounded-full" style={{ background: fg, opacity: 0.4 }} />
        <span
          className="inline-block mt-2 px-2.5 py-1 rounded-md text-[10px] font-semibold"
          style={{ background: accent, color: "#fff" }}
        >
          CTA
        </span>
      </div>
    </div>
  );
}

/** Cartões-esqueleto enquanto `GET /website/templates` carrega. */
function TemplateGallerySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="p-3">
          <div className="h-28 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="mt-3 h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </Card>
      ))}
    </div>
  );
}

function TemplateTab({ site }: { site: Site }) {
  const { data: templates, isLoading, isError } = useGetWebsiteTemplates();
  const save = useSaveSite();
  const [pending, setPending] = useState<SiteTemplate | null>(null);
  const current = site.template;
  const hasSite = !!site.siteId || (site.pages?.length ?? 0) > 0 || !!current;

  const applyTemplate = (t: SiteTemplate) => {
    // `t.site` vem do endpoint (tipagem genérica, gerada pelo Kubb a partir do
    // schema OpenAPI); é o mesmo subconjunto que `PUT /website` aceita.
    save.mutate(t.site as SiteUpsert, {
      onSuccess: () => toast.success(`Template "${t.label}" aplicado.`),
      onError: () => toast.error("Não foi possível aplicar o template."),
    });
  };

  const onChoose = (t: SiteTemplate) => {
    if (t.id === current) return;
    // Se já há site montado, avisar antes de sobrepor.
    if (hasSite) setPending(t);
    else applyTemplate(t);
  };

  return (
    <div>
      <p className="text-sm text-zinc-500 mb-4">
        Escolhe um ponto de partida. Podes afinar tudo depois — cores, páginas e
        conteúdos.
      </p>

      {isLoading && <TemplateGallerySkeleton />}

      {!isLoading && isError && (
        <Card className="p-4 flex items-start gap-3 border-red-200 dark:border-red-900/50">
          <Icon name="alertTriangle" className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">
              Não foi possível carregar os templates
            </p>
            <p className="text-zinc-500 mt-0.5">
              Tenta recarregar a página. Se o problema persistir, fala com o suporte.
            </p>
          </div>
        </Card>
      )}

      {!isLoading && !isError && templates && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((t) => {
            const active = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChoose(t)}
                aria-pressed={active}
                className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 group"
              >
                <Card
                  className={`p-3 h-full transition-colors ${
                    active
                      ? "border-accent ring-1 ring-accent/40"
                      : "group-hover:border-accent/40"
                  }`}
                >
                  <ThumbPreview template={t} />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 dark:text-white truncate">
                        {t.label}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{t.vertical}</p>
                    </div>
                    {active && (
                      <Badge tone="blue" className="shrink-0">
                        Atual
                      </Badge>
                    )}
                  </div>
                  <p className="text-[13px] text-zinc-500 mt-2 leading-snug">
                    {t.description}
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) applyTemplate(pending);
          setPending(null);
        }}
        title="Aplicar outro template?"
        description={
          <>
            Isto substitui a estrutura atual do site (páginas e blocos) pela do
            template <strong>{pending?.label}</strong>. A ação não afeta o
            subdomínio nem o estado de publicação.
          </>
        }
        confirmLabel="Aplicar"
        pendingLabel="A aplicar…"
        variant="warning"
        isPending={save.isPending}
      />
    </div>
  );
}

// ── Tab: Páginas (T23) ────────────────────────────────────────────────────────

/**
 * Endereços que o renderer do site-engine já usa para rotas próprias — uma
 * página do tenant NÃO pode reclamar nenhum destes (colidiria com uma rota
 * real do Next.js, que ganha sempre ao catch-all `app/[[...slug]]`).
 * Fonte: `site-engine/app/**` (lido em 2026-07-03; atualizado em 2026-07-10 —
 * T15/T16):
 *   carrinho    → app/carrinho/page.tsx (carrinho de compras)
 *   checkout    → app/checkout/page.tsx + app/checkout/sucesso/page.tsx
 *   loja        → app/loja/[produto]/page.tsx (ficha de produto)
 *   inscrever   → app/inscrever/page.tsx (T15 — formulário de interesse de
 *                 sócio do ginásio; NÃO cria conta, é um Lead — a inscrição
 *                 real continua a ser só por convite do tenant)
 *   entrar      → app/entrar/page.tsx (T16 — login/registo do cliente final,
 *                 standalone; reusa o `CustomerAuthPanel`)
 *   conta       → app/conta/page.tsx (T16 — perfil + marcações/encomendas do
 *                 cliente final autenticado)
 *   api         → app/api/**  (todos os endpoints server-side do renderer)
 *   robots.txt  → app/robots.ts (rota especial do Next.js)
 *   sitemap.xml → app/sitemap.ts (rota especial do Next.js)
 */
const RESERVED_SLUGS = new Set([
  "carrinho",
  "checkout",
  "loja",
  "inscrever",
  "entrar",
  "conta",
  "api",
  "robots.txt",
  "sitemap.xml",
]);

/** lowercase, sem acentos, só [a-z0-9-] — hífens a separar, sem repetir/rebordar. */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Home = a página cujo slug é vazio (mesma convenção do renderer, `lib/site.ts::findPage`). */
function isHomePage(p: SitePage): boolean {
  return (p.slug ?? "").trim() === "";
}

function sortByOrder(pages: SitePage[]): SitePage[] {
  return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Valida um slug candidato contra os reservados + duplicados (exclui `excludeId`). */
function slugIssue(candidate: string, pages: SitePage[], excludeId?: string): string | null {
  if (!candidate) return "Escreve um endereço válido.";
  if (RESERVED_SLUGS.has(candidate)) return "Esse endereço está reservado.";
  if (pages.some((p) => p.id !== excludeId && (p.slug ?? "").toLowerCase() === candidate)) {
    return "Já existe uma página com esse endereço.";
  }
  return null;
}

function KindToggle({
  value,
  onChange,
  disabled,
}: {
  value: "content" | "collection";
  onChange: (k: "content" | "collection") => void;
  disabled?: boolean;
}) {
  const opt = (k: "content" | "collection", label: string, icon: string) => (
    <button
      key={k}
      type="button"
      aria-pressed={value === k}
      disabled={disabled}
      onClick={() => onChange(k)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        value === k
          ? "bg-accent/10 text-accent"
          : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon name={icon} className="w-3.5 h-3.5" />
      {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
      {opt("content", "Conteúdo", "box")}
      {opt("collection", "Coleção", "grid")}
    </div>
  );
}

function PageRow({
  page,
  index,
  total,
  allPages,
  selected,
  onPatch,
  onMove,
  onRemove,
  onToggleBlocks,
  disabled,
}: {
  page: SitePage;
  index: number;
  total: number;
  allPages: SitePage[];
  selected: boolean;
  onPatch: (id: string, patch: Partial<SitePage>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (page: SitePage) => void;
  onToggleBlocks: (id: string) => void;
  disabled: boolean;
}) {
  const home = isHomePage(page);
  const kind: "content" | "collection" = page.kind === "collection" ? "collection" : "content";
  const [titleDraft, setTitleDraft] = useState(page.title ?? "");
  const [slugDraft, setSlugDraft] = useState(page.slug ?? "");
  const [slugErr, setSlugErr] = useState<string | null>(null);

  useEffect(() => setTitleDraft(page.title ?? ""), [page.title]);
  useEffect(() => setSlugDraft(page.slug ?? ""), [page.slug]);

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t !== (page.title ?? "")) onPatch(page.id, { title: t });
  };

  const commitSlug = () => {
    if (home) return;
    const next = slugify(slugDraft);
    if (next === (page.slug ?? "")) {
      setSlugDraft(next);
      setSlugErr(null);
      return;
    }
    const issue = slugIssue(next, allPages, page.id);
    if (issue) {
      setSlugErr(issue);
      return;
    }
    setSlugErr(null);
    onPatch(page.id, { slug: next });
  };

  const canRemove = !home && total > 1;
  const removeReason = home
    ? "Não é possível remover a página inicial."
    : total <= 1
      ? "Tem de haver pelo menos uma página."
      : undefined;

  return (
    <Card
      className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
        selected ? "border-accent ring-1 ring-accent/40" : ""
      }`}
    >
      <div className="flex sm:flex-col gap-1 shrink-0">
        <IconButton
          icon="arrowUp"
          label="Mover para cima"
          disabled={disabled || index === 0}
          onClick={() => onMove(page.id, -1)}
        />
        <IconButton
          icon="arrowDown"
          label="Mover para baixo"
          disabled={disabled || index === total - 1}
          onClick={() => onMove(page.id, 1)}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            aria-label="Título da página"
            value={titleDraft}
            disabled={disabled}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            placeholder="Página sem título"
            className="font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-accent focus:outline-none px-0.5 min-w-0"
          />
          {home && (
            <Badge tone="blue" className="shrink-0">
              Início
            </Badge>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400 font-mono">
          <span>/</span>
          {home ? (
            <span className="text-zinc-400">(início)</span>
          ) : (
            <input
              aria-label="Endereço da página"
              value={slugDraft}
              disabled={disabled}
              onChange={(e) => {
                setSlugDraft(e.target.value);
                setSlugErr(null);
              }}
              onBlur={commitSlug}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              className="bg-transparent border-b border-dashed border-zinc-300 dark:border-zinc-700 focus:border-accent focus:outline-none px-0.5 w-36"
            />
          )}
        </div>
        {slugErr && <p className="text-xs text-red-500 mt-1">{slugErr}</p>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <KindToggle
          value={kind}
          disabled={disabled}
          onChange={(k) => onPatch(page.id, { kind: k })}
        />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Toggle
            checked={page.inNav !== false}
            disabled={disabled}
            onChange={(next: boolean) => onPatch(page.id, { inNav: next })}
            size="sm"
          />
          <span className="text-xs text-zinc-500">Nav</span>
        </label>
        <IconButton
          icon="layers"
          label="Gerir blocos"
          disabled={disabled}
          onClick={() => onToggleBlocks(page.id)}
          className={selected ? "text-accent bg-accent/10" : ""}
        />
        <IconButton
          icon="trash"
          label="Remover página"
          title={removeReason}
          disabled={!canRemove || disabled}
          onClick={() => onRemove(page)}
          className={canRemove ? "hover:text-red-500" : "opacity-40"}
        />
      </div>
    </Card>
  );
}

function PagesTab({ site }: { site: Site }) {
  const save = useSaveSite();
  const pages = sortByOrder(site.pages ?? []);
  const [pendingRemove, setPendingRemove] = useState<SitePage | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const persist = (next: SitePage[], successMsg?: string) => {
    const withOrder = next.map((p, i) => ({ ...p, order: i }));
    save.mutate(
      { pages: withOrder },
      {
        onSuccess: () => {
          if (successMsg) toast.success(successMsg);
        },
        onError: () => toast.error("Não foi possível guardar as páginas."),
      },
    );
  };

  const onPatch = (id: string, patch: Partial<SitePage>) => {
    persist(pages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = pages.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= pages.length) return;
    const next = [...pages];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const onConfirmRemove = () => {
    if (!pendingRemove) return;
    persist(
      pages.filter((p) => p.id !== pendingRemove.id),
      "Página removida.",
    );
    if (selectedPageId === pendingRemove.id) setSelectedPageId(null);
    setPendingRemove(null);
  };

  const autoSlug = slugify(newTitle);
  const slugFieldValue = slugTouched ? newSlug : autoSlug;
  const finalNewSlug = slugify(slugFieldValue);
  const addTitleMissing = !newTitle.trim();
  const addSlugIssue = addTitleMissing ? null : slugIssue(finalNewSlug, pages);
  const canAdd = !addTitleMissing && !addSlugIssue;

  const onAdd = () => {
    if (!canAdd) return;
    const next: SitePage[] = [
      ...pages,
      {
        id: crypto.randomUUID(),
        slug: finalNewSlug,
        title: newTitle.trim(),
        inNav: true,
        order: pages.length,
        kind: "content",
        blocks: [],
      },
    ];
    persist(next, "Página criada.");
    setNewTitle("");
    setNewSlug("");
    setSlugTouched(false);
  };

  return (
    <div>
      <Card className="p-5 mb-5">
        <SectionTitle>Nova página</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            label="Título"
            placeholder="Ex: Sobre nós"
            value={newTitle}
            onChange={(e: any) => setNewTitle(e.target.value)}
          />
          <Input
            label="Endereço"
            icon="link"
            value={slugFieldValue}
            onChange={(e: any) => {
              setSlugTouched(true);
              setNewSlug(e.target.value);
            }}
            hint="Gerado do título — podes editar."
          />
          <Button icon="plus" onClick={onAdd} disabled={!canAdd} isLoading={save.isPending}>
            Adicionar
          </Button>
        </div>
        {!addTitleMissing && addSlugIssue && (
          <p className="text-xs text-red-500 mt-2">{addSlugIssue}</p>
        )}
      </Card>

      <div className="space-y-3">
        {pages.map((p, i) => (
          <PageRow
            key={p.id}
            page={p}
            index={i}
            total={pages.length}
            allPages={pages}
            selected={p.id === selectedPageId}
            onPatch={onPatch}
            onMove={onMove}
            onRemove={setPendingRemove}
            onToggleBlocks={(id) => setSelectedPageId((cur) => (cur === id ? null : id))}
            disabled={save.isPending}
          />
        ))}
      </div>

      {selectedPage && (
        <PageBlocksSection
          page={selectedPage}
          pages={pages}
          activeLocales={site.activeLocales}
          defaultLocale={site.defaultLocale}
          disabled={save.isPending}
          persist={persist}
        />
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={onConfirmRemove}
        title="Remover página?"
        description={
          <>
            Isto remove definitivamente a página{" "}
            <strong>{pendingRemove?.title || pendingRemove?.slug || "sem título"}</strong>. Não
            podes desfazer esta ação.
          </>
        }
        confirmLabel="Remover"
        pendingLabel="A remover…"
        isPending={save.isPending}
      />
    </div>
  );
}

// ── Tab: Marca ────────────────────────────────────────────────────────────────

// Amostra aproximada de cada preset — não é 1:1 com os tokens reais do
// renderer (`site-engine/app/site-tokens.css`), só uma "assinatura" visual
// por preset para a pré-visualização local. O mapa `dark` usa os tons
// realmente escuros de cada preset (`[data-preset][data-theme="dark"]` no
// site-tokens.css) para que o toggle "Modo" mude visivelmente a amostra.
const BRAND_PREVIEW_COLORS: Record<
  ThemeMode,
  Record<ThemePreset, { bg: string; fg: string; muted: string }>
> = {
  light: {
    slate: { bg: "#0f172a", fg: "#e2e8f0", muted: "#94a3b8" },
    sand: { bg: "#f5f0e6", fg: "#3b352b", muted: "#8a8172" },
    ink: { bg: "#0a0a0a", fg: "#fafafa", muted: "#a1a1aa" },
    mist: { bg: "#eef2f7", fg: "#1f2937", muted: "#6b7280" },
  },
  dark: {
    slate: { bg: "#0b1120", fg: "#e6edf6", muted: "#9fb0c6" },
    sand: { bg: "#1c1815", fg: "#f0e9de", muted: "#c2b4a3" },
    ink: { bg: "#09090b", fg: "#fafafa", muted: "#a1a1aa" },
    mist: { bg: "#101a1c", fg: "#e8f1f2", muted: "#a3babf" },
  },
};

function BrandPreview({
  preset,
  accent,
  font,
  mode,
  logo,
}: {
  preset: ThemePreset;
  accent: ThemeAccent;
  font: ThemeFont;
  mode: ThemeMode;
  logo: string;
}) {
  const c = BRAND_PREVIEW_COLORS[mode][preset];
  // Nomeado → cor curada; hex livre (color-picker) → usa-o diretamente.
  const accentHex = resolveAccentHex(accent);
  return (
    <div
      className="rounded-xl overflow-hidden p-6"
      style={{ background: c.bg, color: c.fg, fontFamily: FONT_STACK[font] }}
    >
      <div className="flex items-center gap-2">
        {logo ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={logo}
            alt="Logo"
            className="h-6 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span
            className="w-6 h-6 rounded-md"
            style={{ background: accentHex }}
          />
        )}
        <span className="text-sm font-semibold">A tua marca</span>
      </div>
      <p
        className="mt-5 text-2xl font-bold leading-tight"
        style={{ fontFamily: FONT_STACK[font] }}
      >
        Título de exemplo
      </p>
      <p className="mt-2 text-sm" style={{ color: c.muted }}>
        Um parágrafo de amostra para dar ideia de como o texto vai ficar.
      </p>
      <span
        className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
        style={{ background: accentHex, color: "#fff" }}
      >
        Botão de ação
      </span>
    </div>
  );
}

function Swatch({
  active,
  onClick,
  label,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        active
          ? "border-accent bg-accent/5 text-accent"
          : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-accent/40"
      }`}
    >
      {color && (
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: color }} />
      )}
      {icon && <Icon name={icon} className="w-4 h-4 shrink-0" />}
      {label}
    </button>
  );
}

function BrandTab({ site }: { site: Site }) {
  const save = useSaveSite();
  const theme = site.theme ?? {};
  const [preset, setPreset] = useState<ThemePreset>(
    (theme.preset as ThemePreset) ?? "slate",
  );
  const [accent, setAccent] = useState<ThemeAccent>(
    (theme.accent as ThemeAccent) ?? "blue",
  );
  const isCustomAccent = !isNamedAccent(accent);
  // Texto livre do campo hex — desacoplado de `accent` para o user poder
  // escrever sem cada tecla inválida apagar a última cor válida guardável
  // (só sincroniza para `accent` quando o texto normaliza para um hex válido;
  // "hex inválido não grava" = `accent` fica no último valor válido).
  const [customHexInput, setCustomHexInput] = useState<string>(
    isCustomAccent ? String(theme.accent) : "",
  );
  const [font, setFont] = useState<ThemeFont>((theme.font as ThemeFont) ?? "grotesk");
  const [mode, setMode] = useState<ThemeMode>((theme.mode as ThemeMode) ?? "light");
  const [logo, setLogo] = useState<string>(theme.logo ?? "");
  const [logoPasteMode, setLogoPasteMode] = useState(false);
  // Upload diferido (como o resto do editor de blocos): o ficheiro escolhido
  // só é enviado ao clicar "Guardar marca" — nunca no momento de escolher.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const onSave = async () => {
    let logoUrl = logo.trim() || null;
    if (logoFile) {
      setUploadingLogo(true);
      try {
        const { fileUrl } = await uploadImage({ image: logoFile, module: "website" });
        logoUrl = fileUrl;
      } catch (err: any) {
        toast.error(err?.message ?? "Erro ao carregar o logótipo");
        setUploadingLogo(false);
        return;
      }
      setUploadingLogo(false);
    }
    const nextTheme: SiteTheme = {
      ...theme,
      preset,
      accent,
      font,
      mode,
      logo: logoUrl,
    };
    save.mutate(
      { theme: nextTheme },
      {
        onSuccess: () => {
          setLogoFile(null);
          toast.success("Marca guardada.");
        },
        onError: () => toast.error("Não foi possível guardar a marca."),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle>Estilo base</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((p) => (
              <Swatch
                key={p}
                active={preset === p}
                onClick={() => setPreset(p)}
                label={PRESET_LABEL[p]}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Modo</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {THEME_MODES.map((m) => (
              <Swatch
                key={m}
                active={mode === m}
                onClick={() => setMode(m)}
                label={MODE_LABEL[m]}
                icon={MODE_ICON[m]}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Cor de destaque</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {THEME_ACCENTS.map((a) => (
              <Swatch
                key={a}
                active={accent === a}
                onClick={() => setAccent(a)}
                label={ACCENT_LABEL[a]}
                color={ACCENT_HEX[a]}
              />
            ))}
            <Swatch
              active={isCustomAccent}
              onClick={() => {
                // Ativa o modo personalizado a partir da última cor livre
                // escolhida (se houver) ou da cor curada atual, para o
                // color-picker nunca abrir "vazio".
                const start = normalizeAccentHex(customHexInput) ?? resolveAccentHex(accent);
                setAccent(start);
                setCustomHexInput(start);
              }}
              label="Personalizada"
              color={isCustomAccent ? resolveAccentHex(accent) : undefined}
              icon={isCustomAccent ? undefined : "plus"}
            />
          </div>
          {isCustomAccent && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="color"
                aria-label="Cor de destaque personalizada"
                value={resolveAccentHex(accent)}
                onChange={(e) => {
                  const v = e.target.value.toLowerCase();
                  setAccent(v);
                  setCustomHexInput(v);
                }}
                className="h-9 w-9 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent p-0.5 cursor-pointer"
              />
              <Input
                aria-label="Hex da cor de destaque"
                value={customHexInput}
                onChange={(e: any) => {
                  const raw = e.target.value;
                  setCustomHexInput(raw);
                  const normalized = normalizeAccentHex(raw);
                  if (normalized) setAccent(normalized);
                }}
                placeholder="#rrggbb"
                className="w-32 font-mono"
              />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Tipografia</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {THEME_FONTS.map((f) => (
              <Swatch
                key={f}
                active={font === f}
                onClick={() => setFont(f)}
                label={FONT_LABEL[f]}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Logótipo</SectionTitle>
          <FileUpload
            module="website"
            currentUrl={logo.trim() || null}
            deferred
            disabled={uploadingLogo || save.isPending}
            onFileSelected={(file) => setLogoFile(file)}
            onDeleted={() => {
              setLogo("");
              setLogoFile(null);
            }}
            label="Carregar logótipo"
          />
          {logoPasteMode ? (
            <Input
              className="mt-2"
              placeholder="https://…/logo.svg"
              icon="link"
              value={logo}
              onChange={(e: any) => {
                setLogo(e.target.value);
                setLogoFile(null);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setLogoPasteMode(true)}
              className="mt-1.5 text-xs text-zinc-400 hover:text-accent underline underline-offset-2"
            >
              ou cola um URL
            </button>
          )}
        </Card>

        <div>
          <Button onClick={onSave} isLoading={save.isPending || uploadingLogo} icon="check">
            Guardar marca
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Pré-visualização</SectionTitle>
        <BrandPreview preset={preset} accent={accent} font={font} mode={mode} logo={logo.trim()} />
        <p className="text-xs text-zinc-400">
          Amostra aproximada das escolhas ainda não guardadas. Para veres o
          site real, usa a Pré-visualização em "O meu site" (depois de
          guardar).
        </p>
      </div>
    </div>
  );
}

// ── Tab: Rodapé & Nav (D1 + D2, site-editor-complete) ─────────────────────────

/**
 * Estado local de um link do rodapé. Nomes de campo alinhados ao renderer
 * (`site-engine/components/blocks/Footer.tsx` lê `label`/`to`, NÃO `href`) —
 * ver também `FooterLink`/`FooterColumn` em `useWebsite.ts`.
 */
interface FooterLinkDraft {
  label: string;
  to: string;
}
interface FooterColumnDraft {
  title: string;
  links: FooterLinkDraft[];
}

const footerInputCls =
  "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

/**
 * `site.nav.items` (formato solto vindo da API) → estado editável — MESMO
 * formato de `FooterLinkDraft` (label/to), por isso o editor reaproveita
 * literalmente o `FooterLinksEditor` já existente. Um `anchor` legado (sem
 * `to`) aparece como `#âncora` no campo de endereço, editável na mesma.
 */
function toNavItemDrafts(items: unknown): FooterLinkDraft[] {
  if (!Array.isArray(items)) return [];
  return (items as NavItem[]).map((it) => ({
    label: typeof it?.label === "string" ? it.label : "",
    to:
      typeof it?.to === "string"
        ? it.to
        : typeof it?.anchor === "string" && it.anchor
          ? `#${it.anchor}`
          : "",
  }));
}

/** `site.footer.columns` (formato solto vindo da API) → estado editável, tudo string. */
function toColumnDrafts(columns: unknown): FooterColumnDraft[] {
  if (!Array.isArray(columns)) return [];
  return (columns as FooterColumn[]).map((c) => {
    const links = Array.isArray(c?.links) ? c.links : [];
    return {
      title: typeof c?.title === "string" ? c.title : "",
      links: links.map((l) => ({
        label: typeof l?.label === "string" ? l.label : "",
        to: typeof l?.to === "string" ? l.to : "",
      })),
    };
  });
}

/** Lista de links (texto + endereço) de UMA coluna do rodapé. */
function FooterLinksEditor({
  links,
  onChange,
  disabled,
}: {
  links: FooterLinkDraft[];
  onChange: (next: FooterLinkDraft[]) => void;
  disabled?: boolean;
}) {
  const setAt = (i: number, patch: Partial<FooterLinkDraft>) => {
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const removeAt = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...links, { label: "", to: "" }]);

  return (
    <div className="space-y-2 mt-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            aria-label={`Texto do link ${i + 1}`}
            value={l.label}
            disabled={disabled}
            onChange={(e) => setAt(i, { label: e.target.value })}
            placeholder="Texto (ex: Contactos)"
            className={`flex-1 min-w-0 ${footerInputCls}`}
          />
          <input
            aria-label={`Endereço do link ${i + 1}`}
            value={l.to}
            disabled={disabled}
            onChange={(e) => setAt(i, { to: e.target.value })}
            placeholder="#ancora, /pagina ou https://…"
            className={`flex-1 min-w-0 ${footerInputCls}`}
          />
          <IconButton
            icon="arrowUp"
            label="Mover link para cima"
            disabled={disabled || i === 0}
            onClick={() => moveAt(i, -1)}
          />
          <IconButton
            icon="arrowDown"
            label="Mover link para baixo"
            disabled={disabled || i === links.length - 1}
            onClick={() => moveAt(i, 1)}
          />
          <IconButton
            icon="trash"
            label="Remover link"
            disabled={disabled}
            onClick={() => removeAt(i)}
            className="hover:text-red-500"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" icon="plus" disabled={disabled} onClick={add}>
        Adicionar link
      </Button>
    </div>
  );
}

/**
 * Colunas do rodapé (título + links). Cada coluna tem a sua própria lista de
 * links — por isso não reaproveita o `ItemsArrayEditor` genérico de
 * `blockFields.tsx` (só suporta campos primitivos por item, não um array
 * aninhado).
 */
function FooterColumnsEditor({
  columns,
  onChange,
  disabled,
}: {
  columns: FooterColumnDraft[];
  onChange: (next: FooterColumnDraft[]) => void;
  disabled?: boolean;
}) {
  const setTitle = (i: number, title: string) => {
    onChange(columns.map((c, idx) => (idx === i ? { ...c, title } : c)));
  };
  const setLinks = (i: number, links: FooterLinkDraft[]) => {
    onChange(columns.map((c, idx) => (idx === i ? { ...c, links } : c)));
  };
  const removeAt = (i: number) => onChange(columns.filter((_, idx) => idx !== i));
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...columns, { title: "", links: [] }]);

  return (
    <div>
      <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        Colunas de links
      </span>
      <div className="space-y-3">
        {columns.map((col, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Coluna {i + 1}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <IconButton
                  icon="arrowUp"
                  label="Mover coluna para cima"
                  disabled={disabled || i === 0}
                  onClick={() => moveAt(i, -1)}
                />
                <IconButton
                  icon="arrowDown"
                  label="Mover coluna para baixo"
                  disabled={disabled || i === columns.length - 1}
                  onClick={() => moveAt(i, 1)}
                />
                <IconButton
                  icon="trash"
                  label="Remover coluna"
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  className="hover:text-red-500"
                />
              </div>
            </div>
            <input
              aria-label={`Título da coluna ${i + 1}`}
              value={col.title}
              disabled={disabled}
              onChange={(e) => setTitle(i, e.target.value)}
              placeholder="Título da coluna (ex: Empresa)"
              className={`w-full ${footerInputCls}`}
            />
            <FooterLinksEditor
              links={col.links}
              onChange={(next) => setLinks(i, next)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="plus" className="mt-2" disabled={disabled} onClick={add}>
        Adicionar coluna
      </Button>
    </div>
  );
}

/**
 * D1 (Footer) + D2 (Nav CTA) — os dois últimos pedaços de conteúdo do site que
 * o tenant não conseguia editar self-serve (chrome global, fora do array
 * `blocks` de qualquer página — por isso não vive no gestor de blocos/T24).
 *
 * Cada secção grava o SEU campo inteiro via `useSaveSite` (whole-field PUT):
 * o Rodapé grava `{ footer }` preservando quaisquer chaves não editadas aqui
 * (spread de `footerSrc`); o CTA grava `{ nav }` preservando SEMPRE
 * `nav.items` (+ outros campos futuros) — só substitui `nav.cta`. Desligar o
 * toggle grava `cta: null`, o que faz o renderer cair no default da vertical
 * (`resolveNavCta` em `site-engine/lib/nav.ts`).
 *
 * **Itens do menu** (override manual, task pendente do site-editor-complete):
 * por omissão (`nav.items` ausente/vazio) o menu deriva-se das páginas com
 * "Nav" ligado (tab Páginas, ordenadas por `order`) — `buildNavLinks` em
 * `site-engine/lib/nav.ts`. O toggle "Personalizado" grava uma lista `items`
 * própria que passa a ganhar SEMPRE (mesmo havendo páginas com Nav ligado);
 * desligar volta ao automático gravando `items: undefined` (ausente, mesmo
 * padrão do `cta: null` do D2 — o renderer volta a derivar das páginas).
 * Reaproveita o `FooterLinksEditor` tal e qual (mesmo formato `{label,to}`).
 */
function FooterNavTab({ site }: { site: Site }) {
  const saveFooter = useSaveSite();
  const saveNav = useSaveSite();
  const saveNavItems = useSaveSite();

  const footerSrc = (site.footer ?? {}) as SiteFooter;
  const [name, setName] = useState(typeof footerSrc.name === "string" ? footerSrc.name : "");
  const [tagline, setTagline] = useState(typeof footerSrc.tagline === "string" ? footerSrc.tagline : "");
  const [smallPrint, setSmallPrint] = useState(
    typeof footerSrc.smallPrint === "string" ? footerSrc.smallPrint : "",
  );
  const [columns, setColumns] = useState<FooterColumnDraft[]>(() => toColumnDrafts(footerSrc.columns));

  const onSaveFooter = () => {
    const nextFooter: SiteFooter = {
      ...footerSrc,
      name: name.trim(),
      tagline: tagline.trim(),
      smallPrint: smallPrint.trim(),
      columns: columns.map((c) => ({
        title: c.title.trim(),
        links: c.links
          .map((l) => ({ label: l.label.trim(), to: l.to.trim() }))
          .filter((l) => l.label || l.to),
      })),
    };
    saveFooter.mutate(
      { footer: nextFooter },
      {
        onSuccess: () => toast.success("Rodapé guardado."),
        onError: () => toast.error("Não foi possível guardar o rodapé."),
      },
    );
  };

  const navSrc = site.nav;
  const existingCta = navSrc?.cta ?? null;
  const [ctaEnabled, setCtaEnabled] = useState(!!existingCta);
  const [ctaLabel, setCtaLabel] = useState(existingCta?.label ?? "");
  const [ctaTo, setCtaTo] = useState(existingCta?.to ?? "");

  const onSaveNav = () => {
    const nextNav: SiteNav = {
      ...(navSrc ?? {}),
      cta:
        ctaEnabled && (ctaLabel.trim() || ctaTo.trim())
          ? { label: ctaLabel.trim(), to: ctaTo.trim() }
          : null,
    };
    saveNav.mutate(
      { nav: nextNav },
      {
        onSuccess: () => toast.success("Botão do menu guardado."),
        onError: () => toast.error("Não foi possível guardar o botão do menu."),
      },
    );
  };

  const existingItems = navSrc?.items ?? [];
  const [itemsMode, setItemsMode] = useState<"auto" | "custom">(
    existingItems.length > 0 ? "custom" : "auto",
  );
  const [navItems, setNavItems] = useState<FooterLinkDraft[]>(() => toNavItemDrafts(existingItems));

  const onSaveNavItems = () => {
    const cleaned = navItems
      .map((l) => ({ label: l.label.trim(), to: l.to.trim() }))
      .filter((l) => l.label || l.to);
    const nextNav: SiteNav = {
      ...(navSrc ?? {}),
      items: itemsMode === "custom" && cleaned.length > 0 ? cleaned : undefined,
    };
    saveNavItems.mutate(
      { nav: nextNav },
      {
        onSuccess: () => toast.success("Itens do menu guardados."),
        onError: () => toast.error("Não foi possível guardar os itens do menu."),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <SectionTitle>Rodapé</SectionTitle>
        <div className="space-y-3">
          <Input
            label="Nome / marca"
            placeholder="Nome mostrado no rodapé"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            hint="Vazio = usa o nome da tua conta."
          />
          <Input
            label="Tagline"
            placeholder="Uma frase curta sobre o negócio"
            value={tagline}
            onChange={(e: any) => setTagline(e.target.value)}
          />
          <FooterColumnsEditor columns={columns} onChange={setColumns} disabled={saveFooter.isPending} />
          <Input
            label="Nota legal"
            placeholder="© 2026 A Tua Marca."
            value={smallPrint}
            onChange={(e: any) => setSmallPrint(e.target.value)}
            hint='Vazio = usa "© {ano} {nome}." automaticamente.'
          />
        </div>
        <div className="mt-4">
          <Button onClick={onSaveFooter} isLoading={saveFooter.isPending} icon="check">
            Guardar rodapé
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>Botão do menu (CTA)</SectionTitle>
        <p className="text-[13px] text-zinc-500 mb-3">
          O botão de destaque no cabeçalho do site (ex: "Marcar", "Inscrever").
          Se desligares, o site usa o botão automático da tua vertical (ou
          nenhum).
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer mb-3">
          <Toggle
            checked={ctaEnabled}
            onChange={setCtaEnabled}
            size="sm"
            label="Mostrar botão personalizado"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-200">Mostrar botão personalizado</span>
        </label>
        {ctaEnabled && (
          <div className="space-y-3">
            <Input
              label="Texto do botão"
              placeholder="Ex: Marcar"
              value={ctaLabel}
              onChange={(e: any) => setCtaLabel(e.target.value)}
            />
            <Input
              label="Endereço"
              icon="link"
              placeholder="#marcar, /contactos ou https://…"
              value={ctaTo}
              onChange={(e: any) => setCtaTo(e.target.value)}
              hint="Normalmente uma âncora da página (ex: #marcar) ou o endereço de uma página do site."
            />
          </div>
        )}
        <div className="mt-4">
          <Button onClick={onSaveNav} isLoading={saveNav.isPending} icon="check">
            Guardar botão do menu
          </Button>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-3">
        <SectionTitle>Itens do menu</SectionTitle>
        <p className="text-[13px] text-zinc-500 mb-3">
          Por omissão, o menu do cabeçalho usa as páginas com "Nav" ligado
          (tab Páginas), pela ordem delas. Liga "Personalizado" para escolher
          os itens do menu à mão — passam a substituir sempre a lista
          automática.
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer mb-3">
          <Toggle
            checked={itemsMode === "custom"}
            onChange={(next: boolean) => setItemsMode(next ? "custom" : "auto")}
            size="sm"
            label="Personalizar itens do menu"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-200">Personalizado</span>
        </label>
        {itemsMode === "custom" && (
          <FooterLinksEditor links={navItems} onChange={setNavItems} disabled={saveNavItems.isPending} />
        )}
        <div className="mt-4">
          <Button onClick={onSaveNavItems} isLoading={saveNavItems.isPending} icon="check">
            Guardar itens do menu
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Domínio ──────────────────────────────────────────────────────────────

const REASON_LABEL: Record<NonNullable<SubdomainCheck["reason"]>, string> = {
  reserved: "Reservado — escolhe outro.",
  too_short: "Demasiado curto.",
  taken: "Já está em uso.",
  invalid: "Formato inválido (usa letras, números e hífens).",
};

function DomainTab({ site }: { site: Site }) {
  const check = useCheckSubdomain();
  const claim = useSetSubdomain();
  const [value, setValue] = useState(site.subdomain ?? "");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "result"; result: SubdomainCheck }
    | { kind: "error" }
  >({ kind: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  // Debounce da verificação de disponibilidade.
  useEffect(() => {
    const trimmed = value.trim().toLowerCase();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!trimmed || trimmed === (site.subdomain ?? "")) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "checking" });
    const reqId = ++reqIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const result = await check(trimmed);
        if (reqId === reqIdRef.current) setState({ kind: "result", result });
      } catch {
        if (reqId === reqIdRef.current) setState({ kind: "error" });
      }
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = value.trim().toLowerCase();
  const available =
    state.kind === "result" && state.result.available && state.result.value === trimmed;
  const canClaim = available && !claim.isPending;

  const onClaim = () => {
    claim.mutate(trimmed, {
      onSuccess: () => toast.success("Subdomínio reclamado."),
      onError: (err: any) => {
        const status = err?.response?.status;
        toast.error(
          status === 409
            ? "Esse subdomínio já está em uso."
            : status === 400
              ? "Subdomínio inválido."
              : "Não foi possível reclamar o subdomínio.",
        );
      },
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <SectionTitle>Subdomínio</SectionTitle>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              label="O teu subdomínio"
              placeholder="a-tua-marca"
              value={value}
              onChange={(e: any) => setValue(e.target.value)}
              icon="globe"
            />
          </div>
          <Button onClick={onClaim} disabled={!canClaim} isLoading={claim.isPending}>
            Reclamar
          </Button>
        </div>

        {/* Feedback de disponibilidade */}
        <div className="mt-2 min-h-[20px] text-sm">
          {state.kind === "checking" && (
            <span className="text-zinc-400 inline-flex items-center gap-1.5">
              <Icon name="loader" className="w-3.5 h-3.5 animate-spin" />
              A verificar…
            </span>
          )}
          {state.kind === "error" && (
            <span className="text-red-500">Não foi possível verificar. Tenta de novo.</span>
          )}
          {state.kind === "result" &&
            state.result.value === trimmed &&
            (state.result.available ? (
              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <Icon name="check" className="w-4 h-4" />
                Disponível
              </span>
            ) : (
              <span className="text-red-500 inline-flex items-center gap-1.5">
                <Icon name="ban" className="w-4 h-4" />
                {state.result.reason
                  ? REASON_LABEL[state.result.reason]
                  : "Indisponível."}
              </span>
            ))}
        </div>

        {trimmed && (
          <p className="text-[13px] text-zinc-500 mt-3">
            O teu site ficará em{" "}
            <span className="font-mono text-zinc-900 dark:text-zinc-100">
              {siteUrl(trimmed)}
            </span>
          </p>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Endereço atual</SectionTitle>
        {site.subdomain ? (
          <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100 break-all">
            {siteUrl(site.subdomain)}
          </p>
        ) : (
          <p className="text-sm text-zinc-400">Ainda sem subdomínio.</p>
        )}
      </Card>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export function Website({ view }: { view: WebsiteView }) {
  const { data: site, isLoading, dataUpdatedAt } = useSite();
  usePageSubtitle("Configura o teu site público — template, marca, domínio e publicação.");

  return (
    <div>
      <PageHeader>
        {site &&
          (site.published ? (
            <Badge tone="green" dot>
              Publicado
            </Badge>
          ) : (
            <Badge tone="amber" dot>
              Rascunho
            </Badge>
          ))}
      </PageHeader>

      {isLoading || !site ? (
        <Card className="p-5">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-4 h-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </Card>
      ) : (
        <>
          {view === "site" && <SiteStatusTab site={site} siteUpdatedAt={dataUpdatedAt} />}
          {view === "template" && <TemplateTab site={site} />}
          {view === "pages" && <PagesTab site={site} />}
          {view === "brand" && <BrandTab site={site} />}
          {view === "footer" && <FooterNavTab site={site} />}
          {view === "domain" && <DomainTab site={site} />}
        </>
      )}
    </div>
  );
}
