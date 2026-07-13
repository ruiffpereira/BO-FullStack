import { useState } from "react";
import { Card, Button, IconButton, Badge, SectionTitle, EmptyState } from "../../ui/ui.jsx";
import { Combobox } from "../Combobox";
import { ConfirmDialog } from "../ConfirmDialog";
import { getBlockSchema, summarizeBlock } from "../../lib/blockCatalog";
import type { SitePage, SiteBlock } from "../../hooks/useWebsite";
import { BlockPaletteModal } from "./BlockPaletteModal";
import { BlockContentModal } from "./BlockContentModal";

/** Uma linha do gestor de blocos: tipo + variante + resumo + ações. */
function BlockRow({
  block,
  index,
  total,
  locale,
  defaultLocale,
  onMove,
  onChangeVariant,
  onEdit,
  onRemove,
  disabled,
  canEditStructure,
}: {
  block: SiteBlock;
  index: number;
  total: number;
  locale: string;
  defaultLocale: string;
  onMove: (id: string, dir: -1 | 1) => void;
  onChangeVariant: (id: string, variant: string) => void;
  onEdit: (block: SiteBlock) => void;
  onRemove: (block: SiteBlock) => void;
  disabled: boolean;
  /** T3.8: sem esta permissão só "Editar conteúdo" fica ativo (sem mover/variante/remover). */
  canEditStructure: boolean;
}) {
  const schema = getBlockSchema(block.type);
  const variant = block.variant || schema.defaultVariant;
  const variantLabel = schema.variants.find((v) => v.id === variant)?.label ?? variant;
  const hasVariantPicker = schema.variants.length > 1;
  const summary = summarizeBlock(block, locale, defaultLocale);

  return (
    <Card className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      {canEditStructure && (
        <div className="flex sm:flex-col gap-1 shrink-0">
          <IconButton
            icon="arrowUp"
            label="Mover bloco para cima"
            disabled={disabled || index === 0}
            onClick={() => onMove(block.id, -1)}
          />
          <IconButton
            icon="arrowDown"
            label="Mover bloco para baixo"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(block.id, 1)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{schema.label}</span>
          {canEditStructure && hasVariantPicker ? (
            <Combobox
              className="w-40"
              value={variant}
              onChange={(v) => onChangeVariant(block.id, v)}
              options={schema.variants.map((v) => ({ value: v.id, label: v.label }))}
              disabled={disabled}
              ariaLabel="Variante"
            />
          ) : (
            variantLabel && <Badge tone="neutral">{variantLabel}</Badge>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-1 truncate">{summary}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <IconButton icon="edit" label="Editar conteúdo" onClick={() => onEdit(block)} disabled={disabled} />
        {canEditStructure && (
          <IconButton
            icon="trash"
            label="Remover bloco"
            onClick={() => onRemove(block)}
            disabled={disabled}
            className="hover:text-red-500"
          />
        )}
      </div>
    </Card>
  );
}

/**
 * Gestor de blocos de UMA página (T24). Vive dentro da tab "Páginas" —
 * renderizado quando uma página está selecionada. Toda a escrita reusa o
 * `persist` (whole-array replace) já usado pelo gestor de páginas (T23): cada
 * ação (adicionar/mover/mudar variante/remover/guardar conteúdo) recalcula o
 * array `blocks` da página selecionada e grava logo o array `pages` inteiro.
 */
export function PageBlocksSection({
  page,
  pages,
  activeLocales,
  defaultLocale,
  disabled,
  persist,
  canEditStructure,
}: {
  page: SitePage;
  pages: SitePage[];
  activeLocales: string[];
  defaultLocale: string;
  disabled: boolean;
  persist: (next: SitePage[], successMsg?: string) => void;
  /** T3.8 (`.design/site-tenant-light/DESIGN_BRIEF.md` secção 3.8): sem
   *  `VIEW_SITE_BUILDER`/`VIEW_ADMIN` só se pode abrir "Editar conteúdo"
   *  (textos/imagens) — sem adicionar/remover/reordenar blocos nem variante. */
  canEditStructure: boolean;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SiteBlock | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SiteBlock | null>(null);

  const blocks = page.blocks ?? [];
  const locale = activeLocales[0] ?? defaultLocale;

  const updateBlocks = (next: SiteBlock[], msg?: string) => {
    persist(
      pages.map((p) => (p.id === page.id ? { ...p, blocks: next } : p)),
      msg,
    );
  };

  const onPick = (type: string) => {
    const schema = getBlockSchema(type);
    const block: SiteBlock = {
      id: crypto.randomUUID(),
      type,
      ...(schema.defaultVariant ? { variant: schema.defaultVariant } : {}),
      settings: { content: {} },
    };
    updateBlocks([...blocks, block], "Bloco adicionado.");
    setPaletteOpen(false);
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    updateBlocks(next);
  };

  const onChangeVariant = (id: string, variant: string) => {
    updateBlocks(blocks.map((b) => (b.id === id ? { ...b, variant } : b)));
  };

  const onConfirmRemove = () => {
    if (!pendingRemove) return;
    updateBlocks(
      blocks.filter((b) => b.id !== pendingRemove.id),
      "Bloco removido.",
    );
    setPendingRemove(null);
  };

  const onSaveContent = (nextContent: Record<string, Record<string, unknown>>) => {
    if (!editingBlock) return;
    updateBlocks(
      blocks.map((b) =>
        // Merge (não substituir) `content`: o modal só edita as línguas ativas — um
        // merge preserva o conteúdo de línguas desativadas em vez de o apagar.
        b.id === editingBlock.id
          ? { ...b, settings: { ...b.settings, content: { ...b.settings?.content, ...nextContent } } }
          : b,
      ),
      "Conteúdo do bloco guardado.",
    );
    setEditingBlock(null);
  };

  return (
    <Card className="p-5 mt-5">
      <SectionTitle
        right={
          canEditStructure ? (
            <Button size="sm" icon="plus" onClick={() => setPaletteOpen(true)} disabled={disabled}>
              Adicionar bloco
            </Button>
          ) : undefined
        }
      >
        Blocos — {page.title || "Página sem título"}
      </SectionTitle>

      {blocks.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Ainda sem blocos"
          desc="Adiciona o primeiro bloco desta página."
        />
      ) : (
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <BlockRow
              key={b.id}
              block={b}
              index={i}
              total={blocks.length}
              locale={locale}
              defaultLocale={defaultLocale}
              onMove={onMove}
              onChangeVariant={onChangeVariant}
              onEdit={setEditingBlock}
              onRemove={setPendingRemove}
              disabled={disabled}
              canEditStructure={canEditStructure}
            />
          ))}
        </div>
      )}

      {canEditStructure && (
        <BlockPaletteModal open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={onPick} />
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={onConfirmRemove}
        title="Remover bloco?"
        description={<>Isto remove definitivamente este bloco da página. Não podes desfazer esta ação.</>}
        confirmLabel="Remover"
        pendingLabel="A remover…"
        isPending={disabled}
      />

      {editingBlock && (
        <BlockContentModal
          block={editingBlock}
          activeLocales={activeLocales.length > 0 ? activeLocales : [defaultLocale]}
          defaultLocale={defaultLocale}
          onClose={() => setEditingBlock(null)}
          onSave={onSaveContent}
          isPending={disabled}
        />
      )}
    </Card>
  );
}
