import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { Icon } from '../ui/icons.jsx'
import { Card, Modal, Input, Button, Badge, PageHeader, EmptyState } from '../ui/ui.jsx'
import { useGetSiteTokens, getSiteTokensQueryKey } from '../gen/backoffice/hooks/useGetSiteTokens.js'
import { usePostSiteTokens } from '../gen/backoffice/hooks/usePostSiteTokens.js'
import { usePatchSiteTokensIdRevoke } from '../gen/backoffice/hooks/usePatchSiteTokensIdRevoke.js'
import { useDeleteSiteTokensId } from '../gen/backoffice/hooks/useDeleteSiteTokensId.js'

type SiteToken = { tokenId: string; label: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string }

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { dateStyle: 'medium' })
}

export function Tokens() {
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens = [], isLoading } = useGetSiteTokens()

  const createMut = usePostSiteTokens({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() })
        setCreateOpen(false)
        setLabel('')
        setNewToken((data as any).token ?? null)
        setCopied(false)
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const revokeMut = usePatchSiteTokensIdRevoke({
    mutation: {
      onSuccess: () => {
        toast.success('Token revogado')
        qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() })
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const deleteMut = useDeleteSiteTokensId({
    mutation: {
      onSuccess: () => {
        toast.success('Token eliminado')
        qc.invalidateQueries({ queryKey: getSiteTokensQueryKey() })
      },
      onError: (e: any) => toast.error(getApiError(e)),
    },
  })

  const copy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) { toast.error('Introduz um nome para o token'); return }
    createMut.mutate({ data: { label: label.trim() } as any })
  }

  const active = (tokens as SiteToken[]).filter((t) => !t.revokedAt)
  const revoked = (tokens as SiteToken[]).filter((t) => t.revokedAt)

  return (
    <div>
      <PageHeader
        title="Tokens de site"
        subtitle="Tokens de acesso para os sites públicos chamarem a API. Cada token identifica o teu site e nunca é guardado em claro."
      />

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">{active.length} {active.length === 1 ? 'token activo' : 'tokens activos'}</p>
            <Button icon="plus" size="sm" onClick={() => { setLabel(''); setCreateOpen(true) }}>Novo token</Button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium px-5 py-3">Nome</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">Criado</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Último uso</th>
                <th className="font-medium px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
                  {[1, 2, 3].map((j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${40 + j * 20}%` }} />
                    </td>
                  ))}
                  <td /><td />
                </tr>
              ))}
              {!isLoading && (tokens as SiteToken[]).map((t) => (
                <tr key={t.tokenId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-zinc-800 dark:text-zinc-100">{t.label}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell text-xs">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell text-xs">{formatDate(t.lastUsedAt ?? null)}</td>
                  <td className="px-4 py-3.5">
                    {t.revokedAt
                      ? <Badge tone="red">Revogado</Badge>
                      : <Badge tone="green">Activo</Badge>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {!t.revokedAt && (
                        <button
                          onClick={() => { if (window.confirm(`Revogar "${t.label}"? O site deixará de conseguir aceder à API.`)) revokeMut.mutate({ id: t.tokenId }) }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
                          title="Revogar"
                        >
                          <Icon name="x" className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { if (window.confirm(`Eliminar "${t.label}" permanentemente?`)) deleteMut.mutate({ id: t.tokenId }) }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                        title="Eliminar"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && (tokens as SiteToken[]).length === 0 && (
            <EmptyState icon="shield" title="Sem tokens" desc="Cria o primeiro token para ligar o teu site à API." />
          )}
        </Card>

        {revoked.length > 0 && (
          <p className="text-xs text-zinc-400 text-center">{revoked.length} token(s) revogado(s) — podes eliminá-los quando quiseres.</p>
        )}
      </div>

      {/* ── Modal: criar token ── */}
      {createOpen && (
        <Modal
          open
          onClose={() => setCreateOpen(false)}
          title="Novo token de site"
          width="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" form="create-token-form" disabled={createMut.isPending}>
                {createMut.isPending ? 'A gerar…' : 'Gerar token'}
              </Button>
            </>
          }
        >
          <form id="create-token-form" onSubmit={handleCreate} className="space-y-3">
            <Input
              label="Nome do token"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Barber Tiago — Produção"
            />
            <p className="text-xs text-zinc-400">
              O valor do token só é mostrado uma vez, imediatamente após a criação. Copia-o para o <code>.env</code> do site.
            </p>
          </form>
        </Modal>
      )}

      {/* ── Modal: mostrar token gerado ── */}
      {newToken && (
        <Modal
          open
          onClose={() => setNewToken(null)}
          title="Token gerado"
          width="max-w-md"
          footer={
            <>
              <Button onClick={copy} icon={copied ? 'check' : 'copy'}>
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
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
            <p className="text-xs text-zinc-400">
              Adiciona ao <code>.env</code> do site: <code className="text-zinc-600">VITE_SITE_TOKEN=&lt;valor&gt;</code>
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
