/**
 * Peças partilhadas pelos editores de bloco/parte/especial (F14): o caminho no topo, o seletor de
 * opções, o rótulo de campo e o rodapé de um item da página (Esconder · Duplicar · Retirar).
 * Alvos ≥ 40 px e nada que só apareça com o rato por cima (`hover:none`).
 */
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import { buildDuplicateItem, neighbours, selFor } from "../state/blocks";
import type { Item } from "../state/types";
import { SeoSeal } from "./SeoBits";

const focusCls = "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
export const backBtn = `inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 ${focusCls}`;
const navBtn = `inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 ${focusCls}`;

export interface CrumbNav {
  index: number;
  total: number;
  prev: { title: string; go: () => void } | null;
  next: { title: string; go: () => void } | null;
}

/** "N de M" e os vizinhos de um item na lista da página (`null` se não está nela). */
export function useItemNav(items: readonly Item[], itemId: string | undefined): CrumbNav | null {
  const { state, manifest, select } = useBuilder();
  const blocks = state.work.blocks;
  return useMemo(() => {
    const n = itemId ? neighbours(items, itemId) : null;
    if (!n) return null;
    const nameOf = (i: Item) => (i.kind === "special" ? manifest?.specials?.[i.specialType ?? ""]?.label ?? "Especial" : blocks.find((b) => b.id === i.blockId)?.name || "Sem nome");
    const link = (i: Item | null) => (i ? { title: nameOf(i), go: () => select({ libId: null, sel: selFor(i) }) } : null);
    return { index: n.index, total: n.total, prev: link(n.prev), next: link(n.next) };
  }, [items, itemId, manifest, blocks, select]);
}

interface CrumbProps {
  backText: string;
  backLabel: string;
  onBack: () => void;
  /** Esconde o "voltar" em ecrãs estreitos (aí já há o "Voltar" da coluna). */
  backClass?: string;
  here: string;
  nav?: CrumbNav | null;
  /** Página de onde se veio: mostra o selo «SEO NN» que abre as suas definições. */
  seo?: { pageId: string; onOpen: () => void };
}

/** "‹ <página> › <bloco>" · SEO · "N de M" · anterior/seguinte. */
export function Crumb({ backText, backLabel, onBack, backClass = "", here, nav, seo }: CrumbProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1">
      <button type="button" aria-label={backLabel} onClick={onBack} className={`${backBtn} -ml-2 max-w-[14rem] ${backClass}`}>
        <Icon name="chevronLeft" className="h-4 w-4 shrink-0" />
        <span className="truncate">{backText}</span>
      </button>
      <span aria-hidden="true" className="text-zinc-400">›</span>
      <span className="min-w-0 max-w-[12rem] truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 sm:max-w-[20rem]">{here}</span>
      <span className="flex-1" />
      {seo && <SeoSeal pageId={seo.pageId} onClick={seo.onOpen} />}
      {nav && (
        <div className="flex items-center">
          <span className="px-1 text-[13px] text-zinc-500 dark:text-zinc-400">{nav.index + 1} de {nav.total}</span>
          <button type="button" aria-label="Bloco anterior" title={nav.prev?.title} disabled={!nav.prev} onClick={nav.prev?.go} className={navBtn}>
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Bloco seguinte" title={nav.next?.title} disabled={!nav.next} onClick={nav.next?.go} className={navBtn}>
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Rótulo de um campo: nome à esquerda, nota à direita. */
export function Lbl({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{children}</span>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

/** Escolha de uma opção entre poucas (fundo, disposição, onde fica). */
export function Seg({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`min-h-10 rounded-lg border px-3 text-sm ${focusCls} ${
            o.id === value
              ? "border-accent bg-accent/10 font-medium text-accent"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Casca de um editor. A partir de 860 px o caminho e o rodapé ficam fixos e só o meio (`editorBody`) faz
 * scroll; abaixo, o editor inteiro faz UM só scroll (as acções fluem no fim). Alturas só por flex.
 */
export const EditorShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-0 flex-1 flex-col max-[859px]:overflow-y-auto">{children}</div>
);
export const editorBody = "mt-2 pr-1 min-[860px]:min-h-0 min-[860px]:flex-1 min-[860px]:overflow-y-auto";

/** Barra de baixo de um editor. `pr-20`: deixa livre o canto onde está o botão flutuante do chat. */
export const EditorFooter = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-zinc-200 py-3 pr-20 dark:border-zinc-800">{children}</div>
);

export const dangerBtn = "text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/10";

/** Confirmação em linha ("Apagar …?" Apagar / Cancelar). */
export function Confirm({ text, action, onYes, onNo }: { text: string; action: string; onYes: () => void; onNo: () => void }) {
  return (
    <>
      <span className="min-w-[180px] flex-1 text-sm text-zinc-700 dark:text-zinc-200">{text}</span>
      <Button variant="danger" size="sm" className="min-h-10" onClick={onYes}>{action}</Button>
      <Button variant="outline" size="sm" className="min-h-10" onClick={onNo}>Cancelar</Button>
    </>
  );
}

/** Rodapé de um item da página (bloco aberto a partir dela, ou especial): Esconder aqui · Duplicar · Retirar desta página. */
export function ItemFooter({ pageId, item, name, uses, duplicateLabel, onFlash }: { pageId: string; item: Item; name: string; uses: number; duplicateLabel: string; onFlash: (itemId: string) => void }) {
  const { state, apply, select } = useBuilder();
  const [confirm, setConfirm] = useState(false);
  const toPage = () => select({ libId: null, sel: { kind: "page", id: pageId } });

  const duplicate = () => {
    const op = buildDuplicateItem(state.work, pageId, item.id);
    if (!op) return;
    apply(op);
    onFlash(op.item.id);
    toPage();
    toast.success(item.kind === "special" ? "Duplicado logo a seguir." : "Criada uma cópia logo a seguir. É um bloco novo: mudar um não muda o outro.");
  };
  const toggleHidden = () => {
    apply({ type: "hideItem", pageId, itemId: item.id, hidden: !item.hidden });
    toast.success(item.hidden ? "Volta a aparecer nesta página." : "Escondido nesta página. Continua guardado e nas outras páginas.");
  };
  const retire = () => {
    apply({ type: "removeItem", pageId, itemId: item.id });
    toPage();
    toast.success(item.kind === "special" || uses > 1 ? "Retirado desta página." : `Retirado. «${name}» continua em Blocos, sem uso.`);
  };

  if (confirm) {
    return (
      <EditorFooter>
        <Confirm text={`Retirar «${name}» desta página?${item.kind === "block" && uses <= 1 ? " O bloco continua em Blocos." : ""}`} action="Retirar" onYes={retire} onNo={() => setConfirm(false)} />
      </EditorFooter>
    );
  }
  return (
    <EditorFooter>
      <Button variant="outline" size="sm" className="min-h-10" icon={item.hidden ? "eye" : "eyeOff"} onClick={toggleHidden}>
        {item.hidden ? "Mostrar aqui" : "Esconder aqui"}
      </Button>
      <Button variant="outline" size="sm" className="min-h-10" icon="copy" onClick={duplicate}>{duplicateLabel}</Button>
      <span className="flex-1" />
      <Button variant="outline" size="sm" className={`min-h-10 ${dangerBtn}`} icon="x" onClick={() => setConfirm(true)}>Retirar desta página</Button>
    </EditorFooter>
  );
}
