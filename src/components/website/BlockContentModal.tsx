import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, Tabs } from "../../ui/ui.jsx";
import { getBlockSchema, getBlockFields } from "../../lib/blockCatalog";
import { RichBlockForm, GenericContentEditor } from "./blockFields";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import {
  useGetCmsEntries,
  getCmsEntriesQueryKey,
} from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { putCmsEntries } from "../../gen/backoffice/hooks/usePutCmsEntries.js";
import { deleteCmsEntries } from "../../gen/backoffice/hooks/useDeleteCmsEntries.js";
import {
  flattenBlockContent,
  unflattenBlockEntries,
  getOrphanedEntryKeys,
  getBlockEntryKeys,
  type CmsEntry,
} from "../../lib/siteCms";
import type { SiteBlock } from "../../hooks/useWebsite";
import { websiteKeys } from "../../hooks/useWebsite";

type ContentDraft = Record<string, Record<string, unknown>>;

/**
 * Aplica o URL final de um upload a um caminho do draft. Caminho:
 * `${locale}|${fieldKey}` (campo de imagem de topo) ou
 * `${locale}|${fieldKey}|${itemIndex}|${subKey}` (sub-campo dentro de um `items`).
 */
function applyPendingUpload(draft: ContentDraft, path: string, fileUrl: string): ContentDraft {
  const [locale, fieldKey, idxStr, subKey] = path.split("|");
  const content = { ...(draft[locale] ?? {}) };
  if (idxStr === undefined) {
    content[fieldKey] = fileUrl;
  } else {
    const idx = Number(idxStr);
    const rows = Array.isArray(content[fieldKey]) ? [...(content[fieldKey] as Record<string, unknown>[])] : [];
    if (rows[idx]) rows[idx] = { ...rows[idx], [subKey]: fileUrl };
    content[fieldKey] = rows;
  }
  return { ...draft, [locale]: content };
}

/**
 * Modal de conteúdo de um bloco: tabs por língua ativa (draft local por
 * língua, seedado do CMS com fallback a `block.settings.content` inline),
 * com o formulário rico do tipo ou o editor genérico chave/valor como fallback.
 *
 * "Guardar" faz upsert das entradas CMS (flatten do draft) e apaga índices órfãos
 * de listas (quando um item é removido).
 *
 * Campos `image` (upload, T-imagem): o ficheiro escolhido fica só local
 * (preview blob:, ver `ImageFieldInput`/`FileUpload` em modo `deferred`) —
 * o upload real (`uploadImage`) só acontece aqui, ao clicar "Guardar", para
 * cada caminho pendente em `pendingFilesRef`; só depois se chama `onSave`
 * com o draft já com os URLs finais. Evita ficheiros órfãos no storage se o
 * modal for cancelado.
 */
export function BlockContentModal({
  block,
  activeLocales,
  defaultLocale,
  onClose,
  isPending,
}: {
  block: SiteBlock;
  activeLocales: string[];
  defaultLocale: string;
  onClose: () => void;
  isPending?: boolean;
}) {
  const locales = activeLocales.length > 0 ? activeLocales : [defaultLocale];
  const [locale, setLocale] = useState(locales[0]);
  const queryClient = useQueryClient();
  const { data: cmsEntries = [] } = useGetCmsEntries();

  const [draft, setDraft] = useState<ContentDraft>(() => {
    const seed: ContentDraft = {};
    for (const loc of locales) {
      // Try to read from CMS first, fallback to inline content
      const cmsContent = unflattenBlockEntries(block.id, cmsEntries as CmsEntry[], loc);
      const inlineContent = (block.settings?.content?.[loc] as Record<string, unknown>) ?? {};
      // CMS overrides inline (field-by-field)
      seed[loc] = { ...inlineContent, ...cmsContent };
    }
    return seed;
  });
  const pendingFilesRef = useRef<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);

  const schema = getBlockSchema(block.type);
  // Campos por VARIANTE quando existam (ex.: blocos tifas) — senão os do tipo.
  const fields = getBlockFields(block.type, block.variant);
  const currentContent = draft[locale] ?? {};

  const setContent = (next: Record<string, unknown>) => {
    setDraft((prev) => ({ ...prev, [locale]: next }));
  };

  const onPendingFile = (path: string, file: File | null) => {
    const key = `${locale}|${path}`;
    if (file) pendingFilesRef.current[key] = file;
    else delete pendingFilesRef.current[key];
  };

  const localeTabs = locales.map((loc) => ({ id: loc, label: loc.toUpperCase() }));

  const handleSave = async () => {
    setUploading(true);
    try {
      // Step 1: Upload pending images
      const pending = Object.entries(pendingFilesRef.current);
      let next = draft;
      if (pending.length > 0) {
        for (const [path, file] of pending) {
          const { fileUrl } = await uploadImage({ image: file, module: "website" });
          next = applyPendingUpload(next, path, fileUrl);
        }
        pendingFilesRef.current = {};
      }

      // Step 2: Flatten draft and upsert CMS entries (await for error handling)
      const entriesToUpsert: CmsEntry[] = [];
      for (const loc of locales) {
        const content = next[loc] ?? {};
        const flattened = flattenBlockContent(block.id, loc, content);
        entriesToUpsert.push(...flattened);
      }

      // Upsert all entries — if any fails, throw and keep modal open
      await Promise.all(
        entriesToUpsert.map((entry) =>
          putCmsEntries({
            key: entry.key,
            locale: entry.locale,
            value: entry.value,
            type: entry.type,
          })
        )
      );

      // Invalidate CMS + Site queries to reflect changes (PreviewPanel will re-mint token)
      queryClient.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["cms-search"] });
      queryClient.invalidateQueries({ queryKey: websiteKeys.site });

      // Success — close modal (onSave called without arguments, content stays in CMS only)
      toast.success("Conteúdo guardado");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao guardar conteúdo");
      // Modal stays open for retry
    } finally {
      setUploading(false);
    }
  };

  const busy = isPending || uploading;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar conteúdo — ${schema.label}`}
      subtitle="As alterações são por língua — muda de separador para editar as outras."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button icon="check" isLoading={busy} onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      {localeTabs.length > 1 && (
        <div className="mb-4">
          <Tabs tabs={localeTabs} value={locale} onChange={(id: string) => setLocale(id)} size="sm" />
        </div>
      )}

      {schema.dataHint && (
        <p
          role="note"
          className="mb-4 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200"
        >
          {schema.dataHint}
        </p>
      )}

      {fields.length > 0 ? (
        <RichBlockForm
          fields={fields}
          content={currentContent}
          onChange={setContent}
          disabled={busy}
          onPendingFile={onPendingFile}
        />
      ) : (
        <GenericContentEditor
          key={locale}
          initialContent={currentContent}
          onChange={setContent}
          disabled={busy}
        />
      )}
    </Modal>
  );
}
