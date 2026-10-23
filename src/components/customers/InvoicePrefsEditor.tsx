import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Input, Toggle } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { getCustomersIdHistoryQueryKey } from "../../gen/backoffice/hooks/useGetCustomersIdHistory.js";
import { patchCustomersId } from "../../gen/backoffice/hooks/usePatchCustomersId.js";

/**
 * Equipa (B41 2b): quem tem `agenda.marcacoes` (edit) mas NÃO `clientes.lista` (edit) só pode mexer na preferência
 * de fatura do cliente (NIF + "quer fatura") — o resto da ficha (nome, notas, bloquear) fica fechado, e a API
 * recusa qualquer outro campo com 403 `TEAM_FORBIDDEN`.
 */
export function InvoicePrefsEditor({
  customerId,
  nif,
  wantsInvoice,
}: {
  customerId: string;
  nif: string | null;
  wantsInvoice: boolean;
}) {
  const qc = useQueryClient();
  const [want, setWant] = useState(wantsInvoice);
  const [nifInput, setNifInput] = useState(nif ?? "");
  useEffect(() => {
    setWant(wantsInvoice);
    setNifInput(nif ?? "");
  }, [customerId, nif, wantsInvoice]);
  const dirty = want !== wantsInvoice || nifInput.trim() !== (nif ?? "");
  const save = useMutation({
    mutationFn: () => patchCustomersId(customerId, { wantsInvoice: want, nif: nifInput.trim() || null }),
    onSuccess: () => {
      toast.success("Preferência de fatura guardada");
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() });
      qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(customerId) });
    },
    onError: (e: any) => toast.error(getApiError(e)),
  });
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Contribuinte na fatura</p>
          <p className="text-xs text-zinc-400">Emitir com o NIF do cliente.</p>
        </div>
        <Toggle checked={want} onChange={setWant} />
      </div>
      {want && (
        <Input
          label="NIF"
          value={nifInput}
          inputMode="numeric"
          placeholder="9 dígitos"
          onChange={(e: any) => setNifInput(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      )}
      <div className="flex justify-end">
        {/* Folha explícita: a edição da preferência é da Agenda, esteja a ficha onde estiver. */}
        <GuardButton leaf="agenda.marcacoes" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "A guardar…" : "Guardar"}
        </GuardButton>
      </div>
    </div>
  );
}
