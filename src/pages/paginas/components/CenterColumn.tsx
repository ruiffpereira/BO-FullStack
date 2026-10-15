/**
 * Coluna do centro. Mostra, por ordem de prioridade:
 *  1. um bloco aberto a partir da biblioteca (`libId`);
 *  2. o item aberto a partir da página — Topo/Rodapé, bloco ou especial (marcador até ao F14);
 *  3. a página escolhida (F12: cabeçalho, separadores, conteúdo);
 *  4. o convite a escolher uma página.
 * Em ecrãs < 860 px é o 2.º ecrã (lista → página → bloco); "Voltar" desfaz um nível.
 */
import { EmptyState } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import type { Item } from "../state/types";
import { FieldsDemo, type DemoSource } from "./FieldsDemo";
import { PageContent } from "./PageContent";

interface Props {
  className: string;
  /** Volta à lista (só < 860 px). */
  onBack: () => void;
  onAdd: (at: number) => void;
  flash: string | null;
  onFlash: (itemId: string) => void;
}

const backBtn =
  "self-start inline-flex items-center gap-1 min-h-10 -ml-2 px-2 mb-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function Marker({ title, sub, demo }: { title: string; sub: string; demo?: DemoSource }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
      {demo ? <FieldsDemo source={demo} /> : null}
      <p className="mt-6 text-sm text-zinc-400">O editor completo chega na próxima fatia.</p>
    </div>
  );
}

export function CenterColumn({ className, onBack, onAdd, flash, onFlash }: Props) {
  const { state, manifest, select } = useBuilder();
  const { work, sel } = state;
  const page = work.pages.find((p) => p.id === state.pageId) ?? null;

  const libBlock = state.libId ? work.blocks.find((b) => b.id === state.libId) ?? null : null;
  const part = sel?.kind === "part" ? sel.id : null;
  // O item aberto a partir da página (bloco com `ref`, ou especial).
  const itemId = sel?.kind === "item" ? sel.id : sel?.kind === "block" ? sel.ref : undefined;
  const openItem: Item | null = !libBlock && !part && itemId ? Object.values(work.items).flat().find((it) => it.id === itemId) ?? null : null;

  const backToPage = () => select({ libId: null, sel: page ? { kind: "page", id: page.id } : null });
  const nested = !libBlock && (part !== null || openItem !== null);

  let content;
  if (libBlock) {
    content = <Marker title={libBlock.name || "Sem nome"} sub="Bloco da biblioteca" demo={{ kind: "block", id: libBlock.id }} />;
  } else if (part) {
    content = <Marker title={part === "topo" ? "Topo" : "Rodapé"} sub="Parte comum, igual em todas as páginas" demo={{ kind: "part", id: part }} />;
  } else if (openItem) {
    const block = openItem.kind === "block" ? work.blocks.find((b) => b.id === openItem.blockId) : null;
    const label = openItem.kind === "special" ? manifest?.specials?.[openItem.specialType ?? ""]?.label ?? openItem.specialType ?? "Especial" : block?.name || "Sem nome";
    content = <Marker
        title={label}
        sub={openItem.kind === "special" ? "Especial deste site" : "Bloco desta página"}
        demo={openItem.kind === "special" ? { kind: "item", id: openItem.id } : block ? { kind: "block", id: block.id } : undefined}
      />;
  } else if (page) {
    content = <PageContent key={page.id} page={page} onAdd={onAdd} flash={flash} onFlash={onFlash} />;
  } else {
    content = <EmptyState icon="layers" title="Escolhe uma página" desc="Seleciona uma página na lista para a ver aqui." />;
  }

  return (
    <section className={`${className} flex-col flex-1 min-w-0 min-h-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900`}>
      {nested && page ? (
        <button type="button" onClick={backToPage} className={backBtn}>
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar à página
        </button>
      ) : (
        <button type="button" onClick={onBack} aria-label="Voltar à lista" className={`min-[860px]:hidden ${backBtn}`}>
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </button>
      )}
      {content}
    </section>
  );
}
