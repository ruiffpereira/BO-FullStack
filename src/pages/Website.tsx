import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  Button,
  Badge,
  Input,
  PageHeader,
  Tabs,
  SectionTitle,
} from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  useSite,
  useSaveSite,
  useCheckSubdomain,
  useSetSubdomain,
  usePublishSite,
  type Site,
  type SiteTheme,
  type ThemePreset,
  type ThemeAccent,
  type ThemeFont,
  type SubdomainCheck,
} from "../hooks/useWebsite";
import {
  SITE_TEMPLATES,
  ACCENT_HEX,
  ACCENT_LABEL,
  PRESET_LABEL,
  FONT_LABEL,
  FONT_STACK,
  THEME_PRESETS,
  THEME_ACCENTS,
  THEME_FONTS,
  type SiteTemplate,
} from "../lib/siteTemplates";

/**
 * "Website" — área self-serve onde o tenant configura o site público
 * (renderizado pelo site-engine à parte). Tabs: O meu site (estado + publicar),
 * Template (galeria de arranque), Marca (preset/accent/fonte/logo) e Domínio
 * (subdomínio com verificação). Gestores de página/bloco ficam fora deste ecrã.
 *
 * Env (opcionais, defaults de dev):
 *   VITE_RENDERER_URL     — base do renderer (default http://localhost:3000)
 *   VITE_SITE_ROOT_DOMAIN — domínio raiz mostrado no URL (default localhost)
 */

const RENDERER_URL = import.meta.env.VITE_RENDERER_URL ?? "http://localhost:3000";
const ROOT_DOMAIN = import.meta.env.VITE_SITE_ROOT_DOMAIN ?? "localhost";

type TabId = "site" | "template" | "brand" | "domain";

const TABS = [
  { id: "site", label: "O meu site", icon: "globe" },
  { id: "template", label: "Template", icon: "layers" },
  { id: "brand", label: "Marca", icon: "star" },
  { id: "domain", label: "Domínio", icon: "link" },
];

/** URL público mostrado ao tenant ({subdomain}.{ROOT_DOMAIN}). */
function siteUrl(subdomain: string | null): string {
  return subdomain ? `${subdomain}.${ROOT_DOMAIN}` : "";
}

/** Link "Ver site" — no renderer (em dev: http://{subdomain}.localhost:3000). */
function siteHref(subdomain: string | null): string {
  if (!subdomain) return RENDERER_URL;
  try {
    const u = new URL(RENDERER_URL);
    return `${u.protocol}//${subdomain}.${u.host}`;
  } catch {
    return RENDERER_URL;
  }
}

// ── Checklist de setup ────────────────────────────────────────────────────────

interface SetupStep {
  key: string;
  label: string;
  done: boolean;
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
  ];
}

// ── Tab: O meu site ───────────────────────────────────────────────────────────

function SiteStatusTab({ site }: { site: Site }) {
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
  );
}

// ── Tab: Template ─────────────────────────────────────────────────────────────

function ThumbPreview({ template }: { template: SiteTemplate }) {
  const { bg, fg, accent } = template.thumb;
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

function TemplateTab({ site }: { site: Site }) {
  const save = useSaveSite();
  const [pending, setPending] = useState<SiteTemplate | null>(null);
  const current = site.template;
  const hasSite = !!site.siteId || (site.pages?.length ?? 0) > 0 || !!current;

  const applyTemplate = (t: SiteTemplate) => {
    save.mutate(t.site, {
      onSuccess: () => toast.success(`Template "${t.name}" aplicado.`),
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SITE_TEMPLATES.map((t) => {
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
                      {t.name}
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
            template <strong>{pending?.name}</strong>. A ação não afeta o
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

// ── Tab: Marca ────────────────────────────────────────────────────────────────

function BrandPreview({
  preset,
  accent,
  font,
  logo,
}: {
  preset: ThemePreset;
  accent: ThemeAccent;
  font: ThemeFont;
  logo: string;
}) {
  const bgByPreset: Record<ThemePreset, { bg: string; fg: string; muted: string }> = {
    slate: { bg: "#0f172a", fg: "#e2e8f0", muted: "#94a3b8" },
    sand: { bg: "#f5f0e6", fg: "#3b352b", muted: "#8a8172" },
    ink: { bg: "#0a0a0a", fg: "#fafafa", muted: "#a1a1aa" },
    mist: { bg: "#eef2f7", fg: "#1f2937", muted: "#6b7280" },
  };
  const c = bgByPreset[preset];
  const accentHex = ACCENT_HEX[accent];
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
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
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
  const [font, setFont] = useState<ThemeFont>((theme.font as ThemeFont) ?? "grotesk");
  const [logo, setLogo] = useState<string>(theme.logo ?? "");

  const onSave = () => {
    const nextTheme: SiteTheme = {
      ...theme,
      preset,
      accent,
      font,
      logo: logo.trim() || null,
    };
    save.mutate(
      { theme: nextTheme },
      {
        onSuccess: () => toast.success("Marca guardada."),
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
          </div>
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
          <Input
            label="URL do logótipo"
            placeholder="https://…/logo.svg"
            value={logo}
            onChange={(e: any) => setLogo(e.target.value)}
            hint="Cola o endereço de uma imagem. O upload direto chega mais tarde."
          />
        </Card>

        <div>
          <Button onClick={onSave} isLoading={save.isPending} icon="check">
            Guardar marca
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Pré-visualização</SectionTitle>
        <BrandPreview preset={preset} accent={accent} font={font} logo={logo.trim()} />
        <p className="text-xs text-zinc-400">
          Amostra aproximada. A pré-visualização real do site chega numa próxima
          fase.
        </p>
      </div>
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
              {trimmed}.{ROOT_DOMAIN}
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

export function Website() {
  const [tab, setTab] = useState<TabId>("site");
  const { data: site, isLoading } = useSite();

  return (
    <div>
      <PageHeader
        title="Website"
        subtitle="Configura o teu site público — template, marca, domínio e publicação."
      >
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

      <div className="mb-6">
        <Tabs tabs={TABS} value={tab} onChange={(id: string) => setTab(id as TabId)} />
      </div>

      {isLoading || !site ? (
        <Card className="p-5">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="mt-4 h-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </Card>
      ) : (
        <>
          {tab === "site" && <SiteStatusTab site={site} />}
          {tab === "template" && <TemplateTab site={site} />}
          {tab === "brand" && <BrandTab site={site} />}
          {tab === "domain" && <DomainTab site={site} />}
        </>
      )}
    </div>
  );
}
