import { Modal, Button } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { ImportRow, TYPE_LABEL } from "./model";

/** Pré-visualização da importação CSV/Excel. */
export function ImportModal({ rows, skipped, isPending, onClose, onImport, onDownloadTemplate }: {
  rows: ImportRow[];
  skipped: number;
  isPending: boolean;
  onClose: () => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
}) {
  return (
        <Modal
          open
          onClose={() => !isPending && onClose()}
          title="Importar CSV / Excel"
          width="max-w-2xl"
          footer={
            <>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="mr-auto text-xs text-accent hover:underline"
              >
                Descarregar modelo CSV
              </button>
              <Button
                variant="ghost"
                onClick={() => onClose()}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <GuardButton
                onClick={() => onImport()}
                disabled={rows.length === 0}
                isLoading={isPending}
              >
                {`Importar ${rows.length} ${rows.length === 1 ? "entrada" : "entradas"}`}
              </GuardButton>
            </>
          }
        >
          <div className="space-y-4">
            {skipped > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-lg">
                {skipped}{" "}
                {skipped === 1 ? "linha ignorada" : "linhas ignoradas"}{" "}
                por falta de key ou value.
              </p>
            )}
            {rows.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
                      <tr className="text-left text-zinc-400">
                        <th className="px-3 py-2 font-medium">Key</th>
                        <th className="px-2 py-2 font-medium">Língua</th>
                        <th className="px-2 py-2 font-medium">Tipo</th>
                        <th className="px-2 py-2 font-medium">Secção</th>
                        <th className="px-2 py-2 font-medium">Pai</th>
                        <th className="px-3 py-2 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {rows.slice(0, 25).map((row, i) => (
                        <tr key={i} className="bg-white dark:bg-zinc-900">
                          <td className="px-3 py-1.5">
                            <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1 py-0.5 text-[11px]">
                              {row.key}
                            </code>
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400">
                            {row.locale ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400">
                            {TYPE_LABEL[row.type] ?? row.type}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 max-w-[100px] truncate">
                            {row.sectionName ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400 max-w-[100px] truncate">
                            {row.parentSectionName ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-600 dark:text-zinc-400 max-w-[180px] truncate">
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 25 && (
                  <div className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800">
                    + {rows.length - 25} entradas não mostradas
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-6">
                Nenhuma entrada válida encontrada no ficheiro.
              </p>
            )}
          </div>
        </Modal>
  );
}
