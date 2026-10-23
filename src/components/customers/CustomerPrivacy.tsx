import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Button } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { ConfirmDialog } from "../ConfirmDialog";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { getCustomersIdExport } from "../../gen/backoffice/hooks/useGetCustomersIdExport.js";
import { deleteCustomersId } from "../../gen/backoffice/hooks/useDeleteCustomersId.js";

/** Privacidade (RGPD) da ficha: exportar os dados do cliente e anonimizá-lo (irreversível, com confirmação). */
export function CustomerPrivacy({
  customer,
  canExport,
  canErase,
  onErased,
}: {
  customer: { customerId: string; name: string };
  canExport: boolean;
  canErase: boolean;
  /** Depois de anonimizado (a ficha fecha). */
  onErased: () => void;
}) {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [eraseTarget, setEraseTarget] = useState<{ customerId: string; name: string } | null>(null);

  const exportData = async () => {
    try {
      setExporting(true);
      // O endpoint devolve um blob (ficheiro JSON), não JSON estruturado — o
      // `RequestConfig` do client gerado aceita `responseType` (subset do
      // AxiosRequestConfig), passado direto para o mesmo axiosInstance; o
      // wrapper gerado já devolve `res.data` desembrulhado.
      const blob = await getCustomersIdExport(customer.customerId, { responseType: "blob" });
      const url = URL.createObjectURL(blob as unknown as Blob) // responseType "blob": o tipo gerado descreve o JSON, o runtime é um Blob;
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-cliente-${customer.customerId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e) {
      toast.error(getApiError(e));
    } finally {
      setExporting(false);
    }
  };

  const eraseMut = useMutation({
    mutationFn: (id: string) => deleteCustomersId(id),
    onSuccess: () => {
      toast.success("Dados pessoais anonimizados (RGPD)");
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() });
      setEraseTarget(null);
      onErased();
    },
    onError: (e: any) => toast.error(getApiError(e)),
  });

  if (!canExport && !canErase) return null;
  return (
    <>
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide mr-auto">Privacidade (RGPD)</span>
        {canExport && <Button variant="outline" size="sm" icon="package" isLoading={exporting} onClick={exportData}>Exportar dados</Button>}
        {canErase && <GuardButton variant="outline" size="sm" icon="trash" className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10" onClick={() => setEraseTarget(customer)}>Apagar dados</GuardButton>}
      </div>

      {/* ── RGPD: confirmar anonimização (fora do corpo da ficha: é uma 2.ª modal) ── */}
      {createPortal(
      <ConfirmDialog
        open={!!eraseTarget}
        onClose={() => setEraseTarget(null)}
        onConfirm={() => eraseTarget && eraseMut.mutate(eraseTarget.customerId)}
        variant="danger"
        title="Apagar dados do cliente?"
        description={<>Os dados pessoais de <strong>{eraseTarget?.name}</strong> serão <strong>anonimizados</strong> (nome, email, telefone, NIF, data de nascimento, notas) e as marcações deixam de conter dados pessoais. O histórico e os registos financeiros mantêm-se. <strong>Esta ação é irreversível.</strong></>}
        confirmLabel="Anonimizar"
        pendingLabel="A anonimizar…"
        isPending={eraseMut.isPending}
      />,
      document.body,
      )}
    </>
  );
}
