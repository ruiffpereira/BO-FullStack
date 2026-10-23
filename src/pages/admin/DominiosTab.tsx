import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Input, SectionTitle, EmptyState } from "../../ui/ui.jsx";
import { confirmDialog } from "../../components/confirm";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useGetAdminCorsOrigins, getAdminCorsOriginsQueryKey } from "../../gen/backoffice/hooks/useGetAdminCorsOrigins.js";
import { usePostAdminCorsOrigins } from "../../gen/backoffice/hooks/usePostAdminCorsOrigins.js";
import { useDeleteAdminCorsOriginsCorsoriginid } from "../../gen/backoffice/hooks/useDeleteAdminCorsOriginsCorsoriginid.js";
import { formatDate } from "./shared";

// ─── Domínios permitidos (CORS) tab ─────────────────────────────────────────
export function DominiosTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useGetAdminCorsOrigins();
  const [domain, setDomain] = useState("");

  const extra = data?.extra ?? [];
  const tenants = data?.tenants ?? [];
  const env = data?.env ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminCorsOriginsQueryKey() });

  const addMut = usePostAdminCorsOrigins({
    mutation: {
      onSuccess: () => {
        toast.success("Domínio permitido");
        setDomain("");
        refresh();
      },
      onError: (error: any) => {
        const status = error?.response?.status;
        if (status === 409) toast.error("Esse domínio já está permitido.");
        else if (status === 400) toast.error("Domínio inválido.");
        else toast.error(getApiError(error));
      },
    },
  });

  const removeMut = useDeleteAdminCorsOriginsCorsoriginid({
    mutation: {
      onSuccess: () => {
        toast.success("Domínio removido");
        refresh();
      },
      onError: (error: any) => toast.error(getApiError(error)),
    },
  });

  const submit = () => {
    if (!domain.trim()) {
      toast.error("Introduz um domínio");
      return;
    }
    addMut.mutate({ data: { domain: domain.trim() } });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500 max-w-2xl">
        Os websites dos clientes são permitidos automaticamente. Aqui adicionam-se domínios extra,
        sem ligação a nenhum cliente. Escreve só o domínio (sem <code>https://</code>) — aceita com e
        sem <code>www</code>.
      </p>

      <Card className="p-5">
        <SectionTitle right={<span className="text-xs text-zinc-400">{extra.length}</span>}>Domínios extra</SectionTitle>
        <form
          className="flex items-end gap-2 mb-4"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <div className="flex-1 max-w-sm">
            <Input
              label="Domínio"
              value={domain}
              onChange={(e: any) => setDomain(e.target.value)}
              placeholder="exemplo.pt"
              autoComplete="off"
            />
          </div>
          <GuardButton type="submit" icon="plus" disabled={addMut.isPending}>
            {addMut.isPending ? "A adicionar…" : "Adicionar"}
          </GuardButton>
        </form>

        {isLoading ? (
          <p className="text-sm text-zinc-400">A carregar…</p>
        ) : extra.length === 0 ? (
          <EmptyState icon="globe" title="Sem domínios extra" desc="Só os websites dos clientes e o servidor estão permitidos." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {extra.map((o) => (
              <li key={o.corsOriginId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-medium text-sm text-zinc-900 dark:text-white break-all">{o.domain}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-400 hidden sm:inline">{o.createdAt ? formatDate(o.createdAt) : ""}</span>
                  <GuardIconButton
                    icon="trash"
                    label="Remover"
                    onClick={async () => {
                      if (await confirmDialog({ title: `Remover "${o.domain}"?`, message: "O domínio deixa de ser aceite pela API.", confirmLabel: "Remover", danger: true })) {
                        removeMut.mutate({ corsOriginId: o.corsOriginId! });
                      }
                    }}
                    className="hover:text-red-500"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle right={<span className="text-xs text-zinc-400">{tenants.length}</span>}>Websites dos clientes</SectionTitle>
        {tenants.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum cliente tem website definido.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {tenants.map((t) => (
              <li key={t.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{t.name}</span>
                <span className="text-zinc-500 break-all">{t.domain}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Definido no servidor</SectionTitle>
        {env.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma origem definida.</p>
        ) : (
          <ul className="space-y-1.5">
            {env.map((o) => (
              <li key={o} className="text-sm text-zinc-500 break-all">{o}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-zinc-400 mt-3">Só leitura — alterado na configuração do servidor.</p>
      </Card>
    </div>
  );
}
