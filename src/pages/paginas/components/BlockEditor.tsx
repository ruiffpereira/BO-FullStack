/**
 * Editor de um bloco ou do Topo/Rodapé (F14): caminho, nome/fundo/disposição, lista ordenável de
 * componentes e rodapé de acções. É o mesmo editor para os três:
 *  - **bloco** — nome ("só para si"), fundo, disposição 1/2/3, âncora (avançado), componentes;
 *  - **rodapé** — fundo, disposição e componentes (só os permitidos);
 *  - **topo** — só componentes (sem nome, âncora, disposição nem fundo).
 * Aberto a partir da página (`itemId`): "N de M", anterior/seguinte e Esconder · Duplicar · Retirar.
 * Aberto a partir de Blocos: "Onde é usado" e Duplicar · Apagar (desactivado com cadeado se está em uso).
 * Tudo muda pelo reducer (`apply`/`edit` → desfazer); fundos e componentes vêm do manifest/catálogo.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Input, SectionTitle } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { useBuilder } from "../state/store";
import { buildCopyBlock } from "../state/blocks";
import { blockPages } from "../state/listing";
import { applyOp, type Comp, type Holder, type HolderPatch } from "../state/ops";
import { pageTitle, pagePath } from "../state/tree";
import type { Block } from "../state/types";
import { BlockThumb } from "./BlockThumb";
import { CompPalette } from "./CompPalette";
import { CompRow } from "./CompRow";
import { Confirm, Crumb, EditorFooter, EditorShell, editorBody, ItemFooter, Lbl, Seg, dangerBtn, useItemNav } from "./EditorBits";
import { SortableList } from "./SortableList";

interface Props {
  holder: Holder;
  /** Item da página de onde se abriu (`undefined` = aberto a partir de Blocos, ou é uma parte). */
  itemId?: string;
  onFlash: (itemId: string) => void;
  /** Abre "Definições e SEO" da página. */
  onSeo: () => void;
}

const LAYOUTS = [
  { id: "1", label: "1 coluna" },
  { id: "2", label: "2 colunas" },
  { id: "3", label: "3 colunas" },
];

function AnchorField({ block, patch }: { block: Block; patch: (p: HolderPatch) => void }) {
  const [text, setText] = useState(block.anchor ?? "");
  useEffect(() => setText(block.anchor ?? ""), [block.anchor]);
  const commit = () => patch({ anchor: text });
  return (
    <details className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium text-zinc-600 dark:text-zinc-300">Avançado</summary>
      <div className="flex flex-col gap-2 pb-2 pt-1">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label="Âncora"
              placeholder="#nome-do-bloco"
              value={text}
              className="min-h-10"
              onChange={(e: { target: { value: string } }) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e: { key: string }) => e.key === "Enter" && commit()}
            />
          </div>
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => patch({ anchor: block.name })}>Gerar do nome</Button>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Icon name="link" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Os botões e o menu podem levar a este bloco. Não pode repetir-se noutro bloco.
        </p>
      </div>
    </details>
  );
}

export function BlockEditor({ holder, itemId, onFlash, onSeo }: Props) {
  const { state, manifest, lang, catalog, missing, apply, edit, select } = useBuilder();
  const work = state.work;
  const part = holder.kind === "part" ? holder.id : null;
  const block = holder.kind === "block" ? work.blocks.find((b) => b.id === holder.id) ?? null : null;
  const partData = part ? (work.parts[part] as { layout?: number; bg?: string; comps?: Comp[] } | null) : null;
  const comps = ((block ? block.comps : partData?.comps) ?? []) as Comp[];
  const layout = block ? block.layout : Number(partData?.layout) || 1;
  const bg = block ? block.bg : partData?.bg ?? (holder.kind === "part" ? holder.bg : undefined) ?? "";

  const [openId, setOpenId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // A página de onde se veio: a do item (se o há), senão a escolhida.
  const pageId = (itemId && Object.entries(work.items).find(([, l]) => l.some((it) => it.id === itemId))?.[0]) || state.pageId;
  const page = work.pages.find((p) => p.id === pageId) ?? null;
  const items = (pageId && work.items[pageId]) || [];
  const item = itemId ? items.find((it) => it.id === itemId) ?? null : null;
  const pages = block ? blockPages(work, block.id) : [];
  const fromLibrary = !!block && !item;

  const nav = useItemNav(items, itemId);

  // "Ver onde": abre o componente onde falta a tradução.
  const { focus, reveal } = state;
  useEffect(() => {
    if (reveal === null || !focus || focus.entity !== holder.kind || focus.id !== holder.id) return;
    const cid = /^comps.([^.]+)./.exec(focus.path)?.[1];
    if (cid) setOpenId(cid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const locales = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const m of missing) {
      if (m.entity !== holder.kind || m.id !== holder.id) continue;
      const cid = /^comps\.([^.]+)\./.exec(m.path)?.[1];
      if (!cid) continue;
      const list = out.get(cid) ?? [];
      if (!list.includes(m.locale)) list.push(m.locale);
      out.set(cid, list);
    }
    return out;
  }, [missing, holder.kind, holder.id]);

  if (!block && !part) return null;
  const title = block ? block.name || "Sem nome" : part === "topo" ? "Topo" : "Rodapé";
  const typeLabel = (c: Comp) => catalog?.components.find((x) => x.type === c.type)?.label ?? c.type;
  const patch = (p: HolderPatch, key?: string) => edit((w) => applyOp(w, { type: "setHolder", holder, patch: p }), key);
  const backTo = () => select({ libId: null, sel: page ? { kind: "page", id: page.id } : null });

  const duplicateLibrary = () => {
    if (!block) return;
    const op = buildCopyBlock(work, null, 0, block.id);
    if (op?.type !== "addBlock") return;
    apply(op);
    select({ libId: op.block.id, sel: { kind: "block", id: op.block.id } });
    toast.success("Criada uma cópia em Blocos. É um bloco novo: mudar um não muda o outro.");
  };
  const deleteLibrary = () => {
    if (!block) return;
    apply({ type: "deleteBlock", id: block.id });
    toast.success(`«${title}» apagado.`);
  };

  return (
    <EditorShell>
      <Crumb
        backText={fromLibrary || !page ? "Voltar à página" : pageTitle(page, lang.defaultLanguage)}
        backLabel={fromLibrary || !page ? "Voltar à página" : `Voltar à página ${pageTitle(page, lang.defaultLanguage)}`}
        onBack={backTo}
        backClass={fromLibrary ? "max-[859px]:hidden" : ""}
        here={title}
        nav={nav}
        seo={fromLibrary || !page ? undefined : { pageId: page.id, onOpen: onSeo }}
      />

      <div className={editorBody}>
        <div className="mb-4 flex items-center gap-3">
          <BlockThumb big block={{ layout, bg, comps }} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {block ? "Bloco" : "Parte comum"} · {comps.length} {comps.length === 1 ? "componente" : "componentes"}
              {block ? (pages.length ? ` · em ${pages.length} ${pages.length === 1 ? "página" : "páginas"}` : " · sem uso") : " · igual em todas as páginas"}
            </p>
          </div>
        </div>

        {fromLibrary && (
          <section className="mb-5">
            <SectionTitle>Onde é usado</SectionTitle>
            {pages.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Não está em nenhuma página. Junta-o a uma página com o ＋ «Usar um que já existe», ou apaga-o.</p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5">
                  {pages.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-label={`Ir para ${pageTitle(p, lang.defaultLanguage)}`}
                        onClick={() => select({ pageId: p.id, libId: null, sel: { kind: "page", id: p.id } })}
                        className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-200 px-3 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{pageTitle(p, lang.defaultLanguage)}</b>
                          <small className="block truncate font-mono text-xs text-zinc-500">{pagePath(work.pages, p.id) || "/"}</small>
                        </span>
                        <Icon name="chevronRight" className="h-4 w-4 text-zinc-400" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                  Enquanto estiver numa página, este bloco não pode ser apagado.
                </p>
              </>
            )}
          </section>
        )}

        {pages.length > 1 && (
          <div role="note" className="mb-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            <Icon name="link" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Este bloco está em {pages.length} páginas ({pages.map((p) => pageTitle(p, lang.defaultLanguage)).join(", ")}). O que mudar aqui muda em todas.</span>
          </div>
        )}

        {part && (
          <div role="note" className="mb-5 flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{part === "topo" ? "O topo aparece sempre em cima, em todas as páginas." : "O rodapé aparece sempre em baixo, em todas as páginas."} Ordena as secções arrastando-as e abre cada uma para a editar.</span>
          </div>
        )}

        {part !== "topo" && (
          <section className="mb-5 flex flex-col gap-4">
            <SectionTitle className="!mb-0">{block ? "Bloco" : "Aspeto"}</SectionTitle>
            {block && (
              <Input label="Nome do bloco" hint="Só para ti" className="min-h-10" value={block.name} onChange={(e: { target: { value: string } }) => patch({ name: e.target.value }, `holder:${block.id}|name`)} />
            )}
            {(manifest?.backgrounds?.length ?? 0) > 0 && (
              <div>
                <Lbl>Fundo</Lbl>
                <Seg label="Fundo" value={bg} options={manifest!.backgrounds!} onChange={(id) => patch({ bg: id })} />
              </div>
            )}
            <div>
              <Lbl hint={layout > 1 ? "Ao reduzir, os componentes mudam para a última coluna" : undefined}>Disposição</Lbl>
              <Seg label="Disposição" value={String(layout)} options={LAYOUTS} onChange={(id) => patch({ layout: Number(id) })} />
            </div>
          </section>
        )}

        <section className="mb-4">
          <SectionTitle right={<span className="text-xs text-zinc-400">{comps.length}</span>}>{block ? "Componentes" : "Secções"}</SectionTitle>
          <SortableList<Comp>
            items={comps}
            getId={(c) => c.id}
            getLabel={typeLabel}
            className="flex flex-col gap-2"
            onMove={(from, to, position) => apply({ type: "moveComp", holder, from, to, position })}
            renderItem={(c, ctx) => (
              <CompRow
                holder={holder}
                comp={c}
                layout={layout}
                handle={ctx.handle}
                open={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                locales={locales.get(c.id) ?? []}
                onDuplicated={setOpenId}
              />
            )}
          />
          {comps.length === 0 && <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">Sem componentes ainda.</p>}
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 hover:border-accent hover:bg-accent/5 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-600 dark:text-zinc-300"
          >
            <Icon name="plus" className="h-4 w-4" />
            {block ? "Adicionar componente" : "Adicionar secção"}
          </button>
        </section>

        {block && <AnchorField block={block} patch={(p) => patch(p)} />}
      </div>

      {item && page && (
        <ItemFooter pageId={page.id} item={item} name={title} uses={pages.length} duplicateLabel="Duplicar bloco" onFlash={onFlash} />
      )}
      {fromLibrary && block && (
        <EditorFooter>
          {confirm ? (
            <Confirm text={`Apagar o bloco «${title}» de vez?`} action="Apagar" onYes={deleteLibrary} onNo={() => setConfirm(false)} />
          ) : (
            <>
              <Button variant="outline" size="sm" className="min-h-10" icon="copy" onClick={duplicateLibrary}>Duplicar</Button>
              <span className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className={`min-h-10 ${dangerBtn}`}
                icon={pages.length ? "lock" : "trash"}
                disabled={pages.length > 0}
                title={pages.length ? `Está em ${pages.length} ${pages.length === 1 ? "página" : "páginas"}` : undefined}
                onClick={() => setConfirm(true)}
              >
                Apagar bloco
              </Button>
            </>
          )}
        </EditorFooter>
      )}

      {palette && (
        <CompPalette holder={holder} name={title} at={comps.length} onClose={() => setPalette(false)} onPicked={setOpenId} />
      )}
    </EditorShell>
  );
}
