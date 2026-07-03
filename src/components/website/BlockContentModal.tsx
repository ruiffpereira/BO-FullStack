import { useState } from "react";
import { Modal, Button, Tabs } from "../../ui/ui.jsx";
import { getBlockSchema } from "../../lib/blockCatalog";
import { RichBlockForm, GenericContentEditor } from "./blockFields";
import type { SiteBlock } from "../../hooks/useWebsite";

/**
 * Modal de conteúdo de um bloco: tabs por língua ativa (draft local por
 * língua, seedado de `block.settings.content`), com o formulário rico do tipo
 * ou o editor genérico chave/valor como fallback. "Guardar" escreve o draft
 * inteiro de volta como `block.settings.content` (o resto do bloco —
 * id/type/variant/contentRef/data/outras settings — fica intocado pelo chamador).
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
  const [draft, setDraft] = useState<Record<string, Record<string, unknown>>>(() => {
    const seed: Record<string, Record<string, unknown>> = {};
    for (const loc of locales) {
      seed[loc] = (block.settings?.content?.[loc] as Record<string, unknown>) ?? {};
    }
    return seed;
  });

  const schema = getBlockSchema(block.type);
  const currentContent = draft[locale] ?? {};

  const setContent = (next: Record<string, unknown>) => {
    setDraft((prev) => ({ ...prev, [locale]: next }));
  };

  const localeTabs = locales.map((loc) => ({ id: loc, label: loc.toUpperCase() }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar conteúdo — ${schema.label}`}
      subtitle="As alterações são por língua — muda de separador para editar as outras."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button icon="check" isLoading={isPending} onClick={() => onSave(draft)}>
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
        <RichBlockForm fields={schema.fields} content={currentContent} onChange={setContent} disabled={isPending} />
      ) : (
        <GenericContentEditor
          key={locale}
          initialContent={currentContent}
          onChange={setContent}
          disabled={isPending}
        />
      )}
    </Modal>
  );
}
