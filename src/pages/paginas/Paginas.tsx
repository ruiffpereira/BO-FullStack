import { useState } from "react";
import { Badge, Button, Card, EmptyState } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { Icon } from "../../ui/icons.jsx";
import { useSiteBuilderQuery } from "../../hooks/useSiteBuilder";
import { BuilderProvider, useBuilder } from "./state/store";
import { pageTitle } from "./state/tree";
import { ListColumn } from "./components/ListColumn";

/**
 * Páginas (construtor de páginas, F10): o esqueleto — barra de topo, lista | centro e os avisos de
 * gravação. O desenho da lista e do centro vem nas fatias F11–F15; aqui são marcadores simples.
 *
 * Responsivo (regra permanente do BO): ≥ 1180 px duas colunas; 860–1180 duas mais estreitas;
 * < 860 um ecrã de cada vez (lista → página) com "‹ Voltar". Alturas por flex: o `Shell` é o dono.
 */
export function Paginas() {
  const query = useSiteBuilderQuery();

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
    <BuilderProvider data={query.data} refetch={async () => (await query.refetch()).data}>
      <Editor />
    </BuilderProvider>
  );
}

function Editor() {
  // Em ecrãs estreitos só se vê um ecrã de cada vez.
  const [view, setView] = useState<"list" | "page">("list");
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <TopBar onWhere={() => setView("page")} />
      <Notices />
      <div className="flex flex-1 min-h-0 gap-4">
        <ListColumn
          className={`${view === "list" ? "flex" : "hidden"} min-[860px]:flex`}
          onOpen={() => setView("page")}
        />
        <CenterColumn
          className={`${view === "page" ? "flex" : "hidden"} min-[860px]:flex`}
          onBack={() => setView("list")}
        />
      </div>
    </div>
  );
}

// ── barra de topo ─────────────────────────────────────────────────────────────

function StatusText() {
  const { state, dirty, publish } = useBuilder();
  let tone = "bg-emerald-500";
  let text = "Guardado";
  if (state.status === "saving") { tone = "bg-amber-500 animate-pulse"; text = "A guardar…"; }
  else if (state.status === "conflict") { tone = "bg-red-500"; text = "Conta alterada noutro sítio"; }
  else if (state.status === "invalid" || state.status === "error") { tone = "bg-red-500"; text = "Não foi possível guardar"; }
  else if (dirty) { tone = "bg-amber-500"; text = "Alterações por guardar"; }
  else if (publish?.status === "pending" || publish?.status === "running") { tone = "bg-blue-500 animate-pulse"; text = "A publicar no site…"; }
  else if (publish?.status === "failed") { tone = "bg-red-500"; text = "Falhou a publicação"; }
  else if (publish?.status === "live") { text = "No ar"; }
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
      <span className={`w-2 h-2 rounded-full ${tone}`} aria-hidden="true" />
      {text}
    </span>
  );
}

function TopBar({ onWhere }: { onWhere: () => void }) {
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
      <div className="flex-1 min-w-0" />
      <StatusText />
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

// ── centro (marcador; o desenho vem no F12–F15) ──────────────────────────────

function CenterColumn({ className, onBack }: { className: string; onBack: () => void }) {
  const { state, lang } = useBuilder();
  const page = state.work.pages.find((p) => p.id === state.pageId) ?? null;
  const items = page ? (state.work.items[page.id] ?? []) : [];
  // Bloco ou parte comum escolhidos na lista (o editor deles chega no F13/F14).
  const block = state.libId ? (state.work.blocks.find((b) => b.id === state.libId) ?? null) : null;
  const part = state.sel?.kind === "part" ? state.sel.id : null;
  return (
    <section className={`${className} flex-col flex-1 min-w-0 min-h-0 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900`}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar à lista"
        className="min-[860px]:hidden self-start inline-flex items-center gap-1 min-h-10 -ml-2 px-2 mb-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Icon name="chevronLeft" className="w-4 h-4" />
        Voltar
      </button>
      {block || part ? (
        <>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{block ? (block.name || "Sem nome") : part === "topo" ? "Topo" : "Rodapé"}</h2>
          <p className="mt-1 text-sm text-zinc-500">{block ? "Bloco da biblioteca" : "Parte comum, igual em todas as páginas"}</p>
          <p className="mt-6 text-sm text-zinc-400">O editor chega nas próximas fatias.</p>
        </>
      ) : page ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{pageTitle(page, lang.defaultLanguage)}</h2>
            <Badge tone={page.status === "published" ? "green" : "neutral"}>{page.status === "published" ? "Publicada" : "Rascunho"}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "itens"} nesta página · {state.work.blocks.length} {state.work.blocks.length === 1 ? "bloco" : "blocos"} na biblioteca
          </p>
          <p className="mt-6 text-sm text-zinc-400">O editor da página chega nas próximas fatias.</p>
        </>
      ) : (
        <EmptyState icon="layers" title="Escolhe uma página" desc="Seleciona uma página na lista para a ver aqui." />
      )}
    </section>
  );
}
