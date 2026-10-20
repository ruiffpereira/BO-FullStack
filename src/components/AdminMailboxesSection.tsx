import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Input } from "../ui/ui.jsx";
import { GuardButton } from "./GuardButton";
import {
  useGetAdminUsersUseridMailboxes,
  getAdminUsersUseridMailboxesQueryKey,
} from "../gen/backoffice/hooks/useGetAdminUsersUseridMailboxes.js";
import { usePostAdminUsersUseridMailboxesBusiness } from "../gen/backoffice/hooks/usePostAdminUsersUseridMailboxesBusiness.js";
import { usePostAdminUsersUseridMailboxesMailboxidDisable } from "../gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidDisable.js";
import { usePostAdminUsersUseridMailboxesMailboxidEnable } from "../gen/backoffice/hooks/usePostAdminUsersUseridMailboxesMailboxidEnable.js";
import { mailErrorMessage } from "../lib/mail";

/**
 * Secção «Caixas» do modal Email do Admin (B42 · fases 5 e 6): as caixas do tenant — endereço, tipo, quota, usado,
 * reencaminha para, pendente — e as acções do dono da plataforma: activar a caixa do negócio, desactivar/reactivar a
 * de um membro. Nunca mostra conteúdo de emails nem credenciais (a API também não os devolve).
 */
export function AdminMailboxesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useGetAdminUsersUseridMailboxes(userId, { query: { retry: false } });
  const [quota, setQuota] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminUsersUseridMailboxesQueryKey(userId) });
  const onError = (e: unknown) => toast.error(mailErrorMessage(e));

  const activate = usePostAdminUsersUseridMailboxesBusiness({
    mutation: {
      onSuccess: () => {
        toast.success("Caixa do negócio activa.");
        setQuota("");
        refresh();
      },
      onError,
    },
  });
  const disable = usePostAdminUsersUseridMailboxesMailboxidDisable({
    mutation: {
      onSuccess: () => {
        toast.success("Caixa desactivada. O endereço passa a reencaminhar para a do negócio.");
        refresh();
      },
      onError,
    },
  });
  const enable = usePostAdminUsersUseridMailboxesMailboxidEnable({
    mutation: {
      onSuccess: () => {
        toast.success("Caixa reactivada.");
        refresh();
      },
      onError,
    },
  });

  const boxes = data?.mailboxes ?? [];
  const hasBusiness = boxes.some((b) => b.kind === "business" && b.status === "active");
  const quotaNum = quota.trim() === "" ? undefined : Number(quota);
  const quotaBad = quotaNum !== undefined && (!Number.isInteger(quotaNum) || quotaNum < 50 || quotaNum > 51200);
  const busy = activate.isPending || disable.isPending || enable.isPending;
  const moduleOff = !!data && !data.moduleEnabled;

  return (
    <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4" data-testid="admin-mailboxes">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Caixas</h4>
        {data && !data.configured && <Badge tone="neutral">Por configurar</Badge>}
        {data && data.configured && moduleOff && <Badge tone="amber">Módulo Correio desligado</Badge>}
      </div>

      {isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{mailErrorMessage(error, "Não foi possível carregar as caixas.")}</p>
      ) : boxes.length === 0 ? (
        <p className="text-sm text-zinc-500" data-testid="admin-mailboxes-empty">
          Este negócio ainda não tem caixas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800">
          <table className="w-full text-sm min-w-[40rem]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Endereço</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Quota</th>
                <th className="px-3 py-2">Usado</th>
                <th className="px-3 py-2">Reencaminha para</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acções</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {boxes.map((b) => (
                <tr key={b.mailboxId} data-testid="admin-mailbox-row" className="align-top">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs break-all">{b.address}</span>
                    {b.displayName ? <span className="block text-xs text-zinc-400">{b.displayName}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="mr-1.5">{b.kind === "business" ? "Suporte" : b.kind === "owner" ? "Dono" : b.kind === "admin" ? "Admin" : "Membro"}</span>
                    {b.status === "active" ? <Badge tone="green">Activa</Badge> : <Badge tone="neutral">Desactivada</Badge>}
                    {b.pendingSync && (
                      <Badge tone="amber" className="ml-1">
                        Pendente
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{b.quotaMb != null ? `${b.quotaMb} MB` : "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{b.usedMb != null ? `${b.usedMb} MB` : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs break-all">{b.forwardTo || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    {(b.kind === "member" || b.kind === "owner") &&
                      (b.status === "active" ? (
                        <GuardButton
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => b.mailboxId && disable.mutate({ userId, mailboxId: b.mailboxId })}
                        >
                          Desactivar
                        </GuardButton>
                      ) : (
                        <GuardButton
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => b.mailboxId && enable.mutate({ userId, mailboxId: b.mailboxId })}
                        >
                          Reactivar
                        </GuardButton>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !isError && !hasBusiness && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Input
              label="Quota (MB, opcional)"
              type="number"
              inputMode="numeric"
              min={50}
              max={51200}
              value={quota}
              onChange={(e: any) => setQuota(e.target.value)}
              placeholder="por omissão"
            />
          </div>
          <GuardButton
            icon="mail"
            isLoading={activate.isPending}
            disabled={busy || quotaBad || moduleOff}
            title={moduleOff ? "Dá primeiro o módulo Correio ao negócio (Admin → Permissões)." : undefined}
            onClick={() => activate.mutate({ userId, data: quotaNum !== undefined ? { quotaMb: quotaNum } : {} })}
          >
            Activar a caixa do negócio
          </GuardButton>
          {quotaBad && <p className="basis-full text-xs text-red-600 dark:text-red-400">A quota vai de 50 a 51200 MB.</p>}
        </div>
      )}
    </div>
  );
}
