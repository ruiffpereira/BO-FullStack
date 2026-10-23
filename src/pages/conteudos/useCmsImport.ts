import { useRef, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCmsSectionsQueryKey } from "../../gen/backoffice/hooks/useGetCmsSections.js";
import { getCmsEntriesQueryKey } from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { postCmsSetup } from "../../gen/backoffice/hooks/usePostCmsSetup.js";
import { ConteudosView, ImportRow } from "./model";
import { parseImportFile } from "./importFile";

/** Importação CSV/Excel do CMS: escolha do ficheiro, pré-visualização e envio. */
export function useCmsImport(activeTab: ConteudosView) {
  const qc = useQueryClient();
  // Import state
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSkipped, setImportSkipped] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: () => {
      // Build unique sections preserving parent info; also auto-register parent sections
      const sectionDefs = new Map<string, string | null>(); // name → parentName
      for (const r of importRows) {
        if (r.sectionName && !sectionDefs.has(r.sectionName))
          sectionDefs.set(r.sectionName, r.parentSectionName ?? null);
        if (r.parentSectionName && !sectionDefs.has(r.parentSectionName))
          sectionDefs.set(r.parentSectionName, null);
      }
      return postCmsSetup(
        {
          sections: [...sectionDefs.entries()].map(([name, parentName]) => ({
            name,
            context: activeTab,
            parentName: parentName ?? undefined,
          })) as any,
          entries: importRows.map((r) => ({
            key: r.key,
            locale: r.locale ?? undefined,
            value: r.value,
            type: r.type,
            sectionName: r.sectionName ?? undefined,
          })) as any,
        },
      );
    },
    onSuccess: ({ created, skipped: apiSkipped }) => {
      toast.success(
        `Importação concluída — ${created} criadas${apiSkipped > 0 ? `, ${apiSkipped} já existiam` : ""}`,
      );
      qc.invalidateQueries({ queryKey: getCmsSectionsQueryKey() });
      qc.invalidateQueries({ queryKey: getCmsEntriesQueryKey() });
      setImportModal(false);
      setImportRows([]);
    },
    onError: () => toast.error("Erro ao importar"),
  });

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    parseImportFile(file)
      .then(({ rows, skipped }) => {
        setImportRows(rows);
        setImportSkipped(skipped);
        setImportModal(true);
      })
      .catch((err: Error) =>
        toast.error(`Erro ao ler ficheiro: ${err.message}`),
      );
  }

  return { importFileRef, importModal, setImportModal, importRows, importSkipped, importMut, handleImportFile };
}
