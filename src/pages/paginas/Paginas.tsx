import { useEffect, useState } from "react";
import { Button, Card, EmptyState } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useSiteBuilderQuery } from "../../hooks/useSiteBuilder";
import { BuilderProvider, useBuilder } from "./state/store";
import { ListColumn } from "./components/ListColumn";
import { CenterColumn } from "./components/CenterColumn";
import { BlockPalette, type Created } from "./components/BlockPalette";
import { SiteSeoModal } from "./components/SiteSeoModal";
import { useAuth } from "../../context/AuthContext";
import { PublishNowButton, StatusText } from "./components/PublishStatus";

/**
 * Páginas (construtor de páginas, F10): o esqueleto — barra de topo, lista | centro e os avisos de
 * gravação. O desenho da lista e do centro vem nas fatias F11–F15; aqui são marcadores simples.
 *
 * Responsivo (regra permanente do BO): ≥ 1180 px duas colunas; 860–1180 duas mais estreitas;
 * < 860 um ecrã de cada vez (lista → página) com "‹ Voltar". Alturas por flex: o `Shell` é o dono.
 */
/**
 * Nome do site para o " · <site>" do título no Google: o `siteName` que o dono da plataforma define no Admin
 * (o mesmo que o site público recebe). Sem ele, o nome do tenant que o Backoffice já conhece
 * (`AuthContext.username`); um email não é um nome. Fora do `AuthProvider` (testes isolados) devolve vazio.
 */
function useTenantName(): string {
  try {
    const name = useAuth().username?.trim() ?? "";
    return name.includes("@") ? "" : name;
  } catch {
    return "";
  }
}

export function Paginas() {
  const query = useSiteBuilderQuery();
  const tenantName = useTenantName();

  if (query.isPending) {
    return (
      <div className="h-full flex items-center justify-center" role="status" aria-label="A carregar">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-300 border-t-accent animate-spin dark:border-zinc-700 dark:border-t-accent" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Card>
        <EmptyState
          icon="alertCircle"
          title="Não foi possível carregar as páginas"
          desc="Tenta de novo dentro de instantes."
          action={<Button variant="outline" className="min-h-10" onClick={() => void query.refetch()}>Tentar de novo</Button>}
        />
      </Card>
    );
  }
  if (!query.data.enabled) {
    return (
      <Card>
        <EmptyState
          icon="layers"
          title="O construtor de páginas ainda não está ativo"
          desc="Quando a equipa o ativar para o teu site, é aqui que vais montar e editar as páginas."
        />
      </Card>
    );
  }
  return (
    <BuilderProvider data={query.data} siteName={query.data.siteName?.trim() || tenantName} refetch={async () => (await query.refetch()).data}>
      <Editor />
    </BuilderProvider>
  );
}

function Editor() {
  const { state, select, configured } = useBuilder();
  // Em ecrãs estreitos só se vê um ecrã de cada vez.
  const [view, setView] = useState<"list" | "page">("list");
  // Paleta "Adicionar": `pageId` null = só biblioteca (botão "Novo" dos Blocos).
  const [palette, setPalette] = useState<{ pageId: string | null; at: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const created = (c: Created) => {
    if (c.itemId) setFlash(c.itemId);
    if (c.blockId) {
      select({ libId: c.blockId, sel: { kind: "block", id: c.blockId } });
      setView("page");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <TopBar onWhere={() => setView("page")} onSeoSite={() => setSeoOpen(true)} />
      <Notices />
      {!configured && <NotConfigured />}
      <div className="flex flex-1 min-h-0 gap-4">
        <ListColumn
          className={`${view === "list" ? "flex" : "hidden"} min-[860px]:flex`}
          onOpen={() => setView("page")}
          onNewBlock={configured ? () => setPalette({ pageId: null, at: 0 }) : undefined}
        />
        <CenterColumn
          className={`${view === "page" ? "flex" : "hidden"} min-[860px]:flex`}
          onBack={() => setView("list")}
          onAdd={(at) => configured && setPalette({ pageId: state.pageId, at })}
          flash={flash}
          onFlash={setFlash}
        />
      </div>
      <SiteSeoModal
        open={seoOpen}
        onClose={() => setSeoOpen(false)}
        onOpenPage={(id) => {
          select({ pageId: id, libId: null, sel: { kind: "page", id }, tab: "settings" });
          setView("page");
          setSeoOpen(false);
        }}
      />
      {palette && <BlockPalette pageId={palette.pageId} at={palette.at} onClose={() => setPalette(null)} onCreated={created} />}
    </div>
  );
}

// ── barra de topo ─────────────────────────────────────────────────────────────

function TopBar({ onWhere, onSeoSite }: { onWhere: () => void; onSeoSite: () => void }) {
  const b = useBuilder();
  const saving = b.state.status === "saving";
  const blocked = b.missingCount > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <div className="flex items-center gap-1" role="group" aria-label="Histórico">
        <Button variant="ghost" size="sm" className="min-h-10" disabled={!b.canUndo} onClick={b.undo} title="Desfazer (Ctrl+Z)">
          Desfazer
        </Button>
        <Button variant="ghost" size="sm" className="min-h-10" disabled={!b.canRedo} onClick={b.redo} title="Refazer (Ctrl+Shift+Z)">
          Refazer
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="min-h-10" icon="search" onClick={onSeoSite} title="Ver o SEO de todas as páginas">
        SEO do site
      </Button>
      <div className="flex-1 min-w-0" />
      <StatusText />
      <PublishNowButton />
      {blocked && (
        <button
          type="button"
          onClick={() => { b.goToMissing(); onWhere(); }}
          title="Ir para o próximo campo por traduzir"
          className="inline-flex items-center gap-2 min-h-10 px-3 rounded-lg text-[13px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {b.missingCount} por traduzir · <u>Ver onde</u>
        </button>
      )}
      <GuardButton
        className="min-h-10"
        isLoading={saving}
        disabled={!b.dirty || saving || blocked}
        title={blocked ? "Completa as traduções em falta antes de guardar." : undefined}
        onClick={() => void b.save()}
      >
        Guardar
      </GuardButton>
    </div>
  );
}

// ── avisos de gravação ────────────────────────────────────────────────────────

/** Sem fundos no manifest nenhum bloco gravaria (422 BAD_BG): avisa em vez de deixar criar. */
function NotConfigured() {
  return (
    <div role="status" className="shrink-0 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="flex-1 min-w-0">
        <b className="font-semibold">Este site ainda não está configurado para o construtor — fale com o suporte.</b>{" "}
        Pode criar páginas, mas ainda não é possível juntar blocos nem componentes.
      </span>
    </div>
  );
}

function Notices() {
  const { state, reload, dismiss } = useBuilder();
  if (state.status === "conflict") {
    return (
      <div role="alert" className="shrink-0 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="flex-1 min-w-[220px]">
          Esta conta foi alterada noutro sítio. O teu trabalho continua aqui até escolheres.
        </span>
        <Button size="sm" className="min-h-10" onClick={() => void reload()}>Recarregar</Button>
        <Button size="sm" variant="outline" className="min-h-10" onClick={dismiss}>Continuar a editar</Button>
      </div>
    );
  }
  if (state.status === "invalid") {
    const shown = state.issues.slice(0, 3);
    return (
      <div role="alert" className="shrink-0 flex flex-wrap items-start gap-3 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <div className="flex-1 min-w-[220px]">
          <p className="font-medium">
            Não foi possível guardar: {state.issues.length} {state.issues.length === 1 ? "problema" : "problemas"} a corrigir.
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {shown.map((i, n) => <li key={`${i.entity}-${i.id}-${i.path ?? ""}-${n}`}>{i.message}</li>)}
          </ul>
        </div>
        <Button size="sm" variant="outline" className="min-h-10" onClick={dismiss}>Fechar</Button>
      </div>
    );
  }
  if (state.status === "error" && state.failure) {
    return (
      <div role="alert" className="shrink-0 flex flex-wrap items-center gap-3 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <span className="flex-1 min-w-[220px]">{state.failure.message}</span>
        <Button size="sm" variant="outline" className="min-h-10" onClick={dismiss}>Fechar</Button>
      </div>
    );
  }
  return null;
}

