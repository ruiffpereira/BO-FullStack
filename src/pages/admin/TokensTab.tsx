import { useState } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Badge, Input, Modal } from "../../ui/ui.jsx";
import { Combobox } from "../../components/Combobox";
import { confirmDialog } from "../../components/confirm";
import { useGetUsers } from "../../gen/backoffice/hooks/useGetUsers.js";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useGetSiteTokens, getSiteTokensQueryKey } from "../../gen/backoffice/hooks/useGetSiteTokens.js";
import { usePostSiteTokens } from "../../gen/backoffice/hooks/usePostSiteTokens.js";
import { usePatchSiteTokensIdRevoke } from "../../gen/backoffice/hooks/usePatchSiteTokensIdRevoke.js";
import { useDeleteSiteTokensId } from "../../gen/backoffice/hooks/useDeleteSiteTokensId.js";
import type { User } from "../../gen/backoffice/types/User.js";
import { EmptyRow, SkeletonRows, TableWrapper, formatDate } from "./shared";

export function TokensTab() {
  const qc = useQueryClient()

  const { data: users = [] } = useGetUsers()
  const [selectedUserId, setSelectedUserId] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useGetSiteTokens(selectedUserId ? { userId: selectedUserId } : undefined)

  const createMut = usePostSiteTokens({
    mutation: {
      onSuccess: (data: any) => {
        qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() })
        setCreateOpen(false)
        setLabel("")
        setNewToken(data.token ?? null)
        setCopied(false)
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const revokeMut = usePatchSiteTokensIdRevoke({
    mutation: {
      onSuccess: () => { toast.success("Token revogado"); qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() }) },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const deleteMut = useDeleteSiteTokensId({
    mutation: {
      onSuccess: () => { toast.success("Token eliminado"); qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() }) },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const copy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">Utilizador:</label>
          <Combobox
            className="w-48"
            value={selectedUserId}
            onChange={setSelectedUserId}
            options={[
              { value: "", label: "Todos" },
              ...(users as User[]).map((u) => ({ value: u.userId, label: u.name })),
            ]}
            placeholder="Todos"
            searchPlaceholder="Pesquisar utilizador…"
          />
        </div>
        <Button
          icon="plus"
          size="sm"
          onClick={() => { setLabel(""); setCreateOpen(true) }}
          disabled={!selectedUserId}
        >
          Novo token
        </Button>
      </div>

      <TableWrapper>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3 hidden md:table-cell">Utilizador</th>
            <th className="px-4 py-3 hidden sm:table-cell">Criado</th>
            <th className="px-4 py-3 hidden lg:table-cell">Último uso</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
          {isLoading ? <SkeletonRows cols={6} /> : null}
          {!isLoading && tokens.length === 0 && <EmptyRow cols={6} />}
          {tokens.map((t) => {
            const owner = (users as User[]).find((u) => u.userId === t.userId)
            return (
              <tr key={t.tokenId}>
                <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">{t.label}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell text-xs">{owner?.name ?? t.userId.slice(0, 8) + "…"}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell text-xs">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-3.5 text-zinc-500 hidden lg:table-cell text-xs">{formatDate(t.lastUsedAt)}</td>
                <td className="px-4 py-3.5">
                  {t.revokedAt ? <Badge tone="red">Revogado</Badge> : <Badge tone="green">Activo</Badge>}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-1">
                    {!t.revokedAt && (
                      <GuardIconButton
                        icon="x"
                        label="Revogar"
                        title="Revogar token"
                        onClick={async () => { if (await confirmDialog({ title: `Revogar "${t.label}"?`, message: "O token deixa de funcionar imediatamente.", confirmLabel: "Revogar", danger: true })) revokeMut.mutate({ id: t.tokenId }); }}
                        className="hover:text-amber-500"
                      />
                    )}
                    <GuardIconButton
                      icon="trash"
                      label="Eliminar"
                      onClick={async () => { if (await confirmDialog({ title: `Eliminar "${t.label}"?`, danger: true })) deleteMut.mutate({ id: t.tokenId }); }}
                      className="hover:text-red-500"
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrapper>

      {/* Modal: criar token */}
      {createOpen && (
        <Modal
          open
          onClose={() => setCreateOpen(false)}
          title="Novo token de site"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <GuardButton
                disabled={createMut.isPending}
                onClick={() => {
                  if (!label.trim()) { toast.error("Introduz um nome para o token"); return }
                  createMut.mutate({ data: { label: label.trim(), userId: selectedUserId } })
                }}
              >
                {createMut.isPending ? "A gerar…" : "Gerar token"}
              </GuardButton>
            </>
          }
        >
          <div className="space-y-3">
            <Input
              label="Nome do token"
              value={label}
              onChange={(e: any) => setLabel(e.target.value)}
              placeholder="Barber Tiago — Produção"
            />
            <p className="text-xs text-zinc-400">
              O valor do token só é mostrado uma vez, imediatamente após a criação. Copia-o para o <code>.env</code> do site.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal: mostrar token gerado */}
      {newToken && (
        <Modal
          open
          onClose={() => setNewToken(null)}
          title="Token gerado"
          footer={
            <>
              <Button onClick={copy} icon={copied ? "check" : "copy"}>{copied ? "Copiado!" : "Copiar"}</Button>
              <Button variant="ghost" onClick={() => setNewToken(null)}>Fechar</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Copia agora — não voltarás a ver este valor</p>
              <p className="text-xs text-amber-600 dark:text-amber-300">Este token não é guardado em claro. Se o perderes, revoga e gera um novo.</p>
            </div>
            <div
              onClick={copy}
              className="cursor-pointer bg-zinc-900 dark:bg-zinc-950 rounded-xl p-4 font-mono text-xs text-emerald-400 break-all select-all border border-zinc-700 hover:border-accent transition"
            >
              {newToken}
            </div>
            <p className="text-xs text-zinc-400">Adiciona ao <code>.env</code> do site: <code className="text-zinc-600">VITE_SITE_TOKEN=&lt;valor&gt;</code></p>
          </div>
        </Modal>
      )}
    </div>
  )
}
