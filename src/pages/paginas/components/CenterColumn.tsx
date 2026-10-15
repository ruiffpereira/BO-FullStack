/**
 * Coluna do centro. Mostra, por ordem de prioridade:
 *  1. um bloco aberto a partir da biblioteca (`libId`) — editor de bloco, "Onde é usado";
 *  2. o item aberto a partir da página — Topo/Rodapé e bloco (editor de bloco) ou especial (editor de especial);
 *  3. a página escolhida (F12: cabeçalho, separadores, conteúdo);
 *  4. o convite a escolher uma página.
 * Os editores têm o seu próprio caminho ("‹ página › bloco"), que é o "voltar" (também no telemóvel,
 * onde o editor ocupa o ecrã). Só o bloco da biblioteca mantém o "Voltar" à lista em ecrãs < 860 px.
 */
import { EmptyState } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import type { Item } from "../state/types";
import { BlockEditor } from "./BlockEditor";
import { backBtn } from "./EditorBits";
import { FocusMissing } from "./FocusMissing";
import { PageContent } from "./PageContent";
import { SpecialEditor } from "./SpecialEditor";

interface Props {
  className: string;
  /** Volta à lista (só < 860 px). */
  onBack: () => void;
  onAdd: (at: number) => void;
  flash: string | null;
  onFlash: (itemId: string) => void;
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
  const editing = !!libBlock || !!part || !!openItem;
  // O "SEO NN" do caminho dos editores leva às Definições e SEO da página.
  const onSeo = () => select({ libId: null, sel: page ? { kind: "page", id: page.id } : null, tab: "settings" });

  let content;
  if (libBlock) {
    content = <BlockEditor key={`lib:${libBlock.id}`} holder={{ kind: "block", id: libBlock.id }} onFlash={onFlash} onSeo={onSeo} />;
  } else if (part) {
    content = <BlockEditor key={part} holder={{ kind: "part", id: part, bg: manifest?.backgrounds?.[0]?.id }} onFlash={onFlash} onSeo={onSeo} />;
  } else if (openItem?.kind === "special") {
    content = <SpecialEditor key={openItem.id} itemId={openItem.id} onFlash={onFlash} onSeo={onSeo} />;
  } else if (openItem?.blockId) {
    content = <BlockEditor key={openItem.id} holder={{ kind: "block", id: openItem.blockId }} itemId={openItem.id} onFlash={onFlash} onSeo={onSeo} />;
  } else if (page) {
    content = <PageContent key={page.id} page={page} onAdd={onAdd} flash={flash} onFlash={onFlash} />;
  } else {
    content = <EmptyState icon="layers" title="Escolhe uma página" desc="Seleciona uma página na lista para a ver aqui." />;
  }

  return (
    <section className={`${className} flex-col flex-1 min-w-0 min-h-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900`}>
      {/* Os editores têm o caminho (‹ página › bloco); a lista só se alcança por aqui nos outros casos. */}
      {(!editing || libBlock) && (
        <button type="button" onClick={onBack} aria-label="Voltar à lista" className={`min-[860px]:hidden self-start -ml-2 mb-2 ${backBtn}`}>
          <Icon name="chevronLeft" className="w-4 h-4" />
          Voltar
        </button>
      )}
      {content}
      <FocusMissing />
    </section>
  );
}
