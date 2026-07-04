import { useRef, useState } from "react";
import { toast } from "sonner";
import { Modal, Button, Tabs } from "../../ui/ui.jsx";
import { getBlockSchema } from "../../lib/blockCatalog";
import { RichBlockForm, GenericContentEditor } from "./blockFields";
import { uploadImage } from "../../gen/backoffice/hooks/useUploadImage.js";
import type { SiteBlock } from "../../hooks/useWebsite";

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
 * língua, seedado de `block.settings.content`), com o formulário rico do tipo
 * ou o editor genérico chave/valor como fallback. "Guardar" escreve o draft
 * inteiro de volta como `block.settings.content` (o resto do bloco —
 * id/type/variant/contentRef/data/outras settings — fica intocado pelo chamador).
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
  onSave,
  isPending,
}: {
  block: SiteBlock;
  activeLocales: string[];
  defaultLocale: string;
  onClose: () => void;
  onSave: (nextContent: Record<string, Record<string, unknown>>) => void;
  isPending?: boolean;
}) {
  const locales = activeLocales.length > 0 ? activeLocales : [defaultLocale];
  const [locale, setLocale] = useState(locales[0]);
  const [draft, setDraft] = useState<ContentDraft>(() => {
    const seed: ContentDraft = {};
    for (const loc of locales) {
      seed[loc] = (block.settings?.content?.[loc] as Record<string, unknown>) ?? {};
    }
    return seed;
  });
  const pendingFilesRef = useRef<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);

  const schema = getBlockSchema(block.type);
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
    const pending = Object.entries(pendingFilesRef.current);
    if (pending.length === 0) {
      onSave(draft);
      return;
    }
    setUploading(true);
    try {
      let next = draft;
      for (const [path, file] of pending) {
        const { fileUrl } = await uploadImage({ image: file, module: "website" });
        next = applyPendingUpload(next, path, fileUrl);
      }
      pendingFilesRef.current = {};
      onSave(next);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao carregar imagem");
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

      {schema.fields ? (
        <RichBlockForm
          fields={schema.fields}
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
