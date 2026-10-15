/**
 * Paleta "Adicionar" (F12). Quatro separadores, nesta ordem:
 *  - **Bloco novo** — os pontos de partida do catálogo (§3.3), só atalhos.
 *  - **Usar um que já existe** — partilha o MESMO bloco (mudar um muda em todas as páginas).
 *  - **Copiar um que já existe** — um bloco novo e independente.
 *  - **Especiais deste site** — só se o manifest os declara.
 * Sem página (`pageId === null`, o "Novo" da biblioteca) só há "Bloco novo" e "Copiar", e o resultado
 * fica só na biblioteca. Tudo passa por `apply(op)` — uma entrada no desfazer por escolha.
 */
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Input, Modal, Tabs } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import {
  blockSummary,
  buildAddSpecial,
  buildCopyBlock,
  buildNewBlock,
  buildUseBlock,
  specialEntries,
  usableBlocks,
} from "../state/blocks";
import { blockUsage } from "../state/listing";
import type { WorkOp } from "../state/ops";
import { pageTitle } from "../state/tree";
import type { Block, Starter } from "../state/types";
import { BlockThumb } from "./BlockThumb";

export type PaletteTab = "new" | "use" | "copy" | "special";

/** O que a paleta criou: o item na página (para o destacar) ou só o bloco na biblioteca (para o abrir). */
export interface Created {
  itemId?: string;
  blockId?: string;
}

interface Props {
  /** Página de destino (`null` = só biblioteca). */
  pageId: string | null;
  /** Posição na lista de itens da página. */
  at: number;
  onClose: () => void;
  onCreated: (c: Created) => void;
}

const cardCls =
  "group flex min-h-[88px] w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-accent/50 hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-accent/10";

export function Card({ thumb, title, sub, onClick }: { thumb: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cardCls}>
      {thumb}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</b>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{sub}</span>
      </span>
    </button>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <p className="col-span-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
export const Head = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="col-span-full">
    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
    {sub && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{sub}</p>}
  </div>
);

export function BlockPalette({ pageId, at, onClose, onCreated }: Props) {
  const { state, catalog, manifest, lang, apply } = useBuilder();
  const work = state.work;
  const page = pageId ? work.pages.find((p) => p.id === pageId) : null;
  const specials = useMemo(() => specialEntries(manifest), [manifest]);
  const tabs = [
    { id: "new", label: "Bloco novo" },
    ...(pageId ? [{ id: "use", label: "Usar um que já existe" }] : []),
    { id: "copy", label: "Copiar um que já existe" },
    ...(pageId && specials.length ? [{ id: "special", label: "Especiais deste site" }] : []),
  ];
  const [tab, setTab] = useState<PaletteTab>("new");
  const [query, setQuery] = useState("");
  const usage = useMemo(() => blockUsage(work), [work]);

  const commit = (op: WorkOp | null, created: Created, message: string) => {
    if (!op) return;
    apply(op);
    toast.success(message);
    onCreated(created);
    onClose();
  };
  const itemOf = (op: WorkOp | null) => (op && op.type === "addItem" ? op.item.id : undefined);

  const pickStarter = (s: Starter) => {
    const op = buildNewBlock(work, pageId, at, s, catalog, manifest);
    const blockId = op?.type === "addBlock" ? op.block.id : op?.type === "addItem" ? op.block?.id : undefined;
    commit(op, { itemId: itemOf(op), blockId: pageId ? undefined : blockId }, pageId ? "Bloco novo juntado à página." : "Bloco novo criado em Blocos.");
  };
  const useBlock = (b: Block) => {
    if (!pageId) return;
    const op = buildUseBlock(work, pageId, at, b.id);
    commit(op, { itemId: itemOf(op) }, `«${b.name || "Sem nome"}» juntado a esta página. Está agora em ${(usage.get(b.id) ?? 0) + 1} páginas.`);
  };
  const copyBlock = (b: Block) => {
    const op = buildCopyBlock(work, pageId, at, b.id);
    const blockId = op?.type === "addBlock" ? op.block.id : undefined;
    commit(op, { itemId: itemOf(op), blockId }, `Cópia de «${b.name || "Sem nome"}» criada. É um bloco novo: mudar um não muda o outro.`);
  };
  const addSpecial = (type: string, label: string) => {
    if (!pageId) return;
    const op = buildAddSpecial(work, manifest, pageId, at, type);
    commit(op, { itemId: itemOf(op) }, `«${label}» juntado à página.`);
  };

  const q = query.trim().toLowerCase();
  const filter = (list: Block[]) => (q ? list.filter((b) => b.name.toLowerCase().includes(q)) : list);
  const usable = pageId ? usableBlocks(work, pageId) : [];
  const all = [...work.blocks].sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const searchable = (tab === "use" ? usable : all).length > 6;

  const blockCard = (b: Block, pick: (b: Block) => void) => (
    <Card
      key={b.id}
      thumb={<BlockThumb block={b} />}
      title={b.name || "Sem nome"}
      sub={`${blockSummary(b, catalog)} · ${(usage.get(b.id) ?? 0) === 0 ? "sem uso" : `em ${usage.get(b.id)} ${usage.get(b.id) === 1 ? "página" : "páginas"}`}`}
      onClick={() => pick(b)}
    />
  );

  let body: ReactNode;
  if (tab === "new") {
    const starters = catalog?.starters ?? [];
    body = (
      <>
        <Head title="Ponto de partida" sub="É só um atalho: depois podes mudar tudo." />
        {starters.length === 0 && <Note>O catálogo não trouxe pontos de partida.</Note>}
        {starters.map((s) => (
          <Card
            key={s.id}
            thumb={<BlockThumb block={{ layout: s.layout, bg: manifest?.backgrounds?.[0]?.id ?? "claro", comps: s.comps }} />}
            title={s.label}
            sub={`${blockSummary({ comps: s.comps }, catalog)}${s.layout > 1 ? ` · ${s.layout} colunas` : ""}`}
            onClick={() => pickStarter(s)}
          />
        ))}
      </>
    );
  } else if (tab === "use") {
    const list = filter(usable);
    body = (
      <>
        <Head title="Usar o mesmo bloco" sub="Fica partilhado: mudar aqui muda em todas as páginas onde está." />
        {list.map((b) => blockCard(b, useBlock))}
        {list.length === 0 && <Note>{q ? "Nenhum bloco com esse nome." : usable.length === 0 ? "Todos os blocos já estão nesta página." : ""}</Note>}
      </>
    );
  } else if (tab === "copy") {
    const list = filter(all);
    body = (
      <>
        <Head title="Copiar um bloco" sub="Cria um bloco novo, igual a este. Depois mudar um não muda o outro." />
        {list.map((b) => blockCard(b, copyBlock))}
        {list.length === 0 && <Note>{q ? "Nenhum bloco com esse nome." : "Ainda não há blocos para copiar."}</Note>}
      </>
    );
  } else {
    body = (
      <>
        <Head title="Secções feitas à medida" sub="Fazem parte do desenho deste site e têm os seus próprios campos." />
        {specials.map((s) => (
          <Card
            key={s.type}
            thumb={
              <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300" aria-hidden="true">
                <Icon name="layers" className="h-5 w-5" />
              </span>
            }
            title={s.label}
            sub={s.desc || "Especial deste site"}
            onClick={() => addSpecial(s.type, s.label)}
          />
        ))}
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title={page ? `Adicionar bloco a «${pageTitle(page, lang.defaultLanguage)}»` : "Novo bloco"}
      subtitle={page ? "Cria um bloco novo ou reutiliza um que já existe noutra página." : "Escolhe por onde começar. Depois juntas o bloco às páginas que quiseres."}
    >
      <div className="mb-4">
        <Tabs tabs={tabs} value={tab} onChange={(id: string) => { setTab(id as PaletteTab); setQuery(""); }} />
      </div>
      {searchable && (tab === "use" || tab === "copy") && (
        <div className="mb-3">
          <Input icon="search" aria-label="Procurar bloco" placeholder="Procurar bloco" value={query} onChange={(e: { target: { value: string } }) => setQuery(e.target.value)} className="min-h-10" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{body}</div>
    </Modal>
  );
}
