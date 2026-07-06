import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Badge, Tabs, EmptyState } from '../../ui/ui.jsx'
import { Icon } from '../../ui/icons.jsx'
import { GuardButton } from '../../components/GuardButton'
import { useWriteGuard } from '../../hooks/useWriteGuard'
import { usePagination, Pagination, PAGE_SIZE } from '../../components/Pagination'
import { getApiError } from '../../lib/apiError'
import { useGetLeads, getLeadsQueryKey } from '../../gen/backoffice/hooks/useGetLeads'
import { usePatchLeadsId } from '../../gen/backoffice/hooks/usePatchLeadsId'
import type { Lead, LeadStatusEnum } from '../../gen/backoffice/types/Lead'
import type { GetLeadsQueryParams } from '../../gen/backoffice/types/GetLeads'

const STATUS_PT: Record<LeadStatusEnum, string> = { new: 'Novo', read: 'Lido', archived: 'Arquivado' }
const STATUS_TONE: Record<LeadStatusEnum, 'blue' | 'neutral'> = { new: 'blue', read: 'neutral', archived: 'neutral' }
const MESSAGE_TRUNCATE = 160

type Filter = 'new' | 'all' | 'archived'

const EMPTY_META: Record<Filter, { title: string; desc: string }> = {
  new: { title: 'Sem leads novos', desc: 'Ainda não há pedidos novos por ler.' },
  all: { title: 'Sem leads', desc: 'Quando alguém preencher o formulário de contacto do site, aparece aqui.' },
  archived: { title: 'Sem leads arquivados', desc: 'Os leads arquivados aparecem aqui.' },
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SkeletonRow() {
  return (
    <div className="p-4 sm:p-5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
      <div className="h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-2" />
      <div className="h-3 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )
}

/**
 * Inbox de leads (pedidos de contacto/orçamento capturados no form do site
 * público do tenant, `POST /websites/leads` — ver `leadController.ts` na API).
 * Vive na rota `/clientes/leads` (submenu da página Clientes, T2.2 — ver
 * `Clientes.tsx`/`src/lib/navigation.ts`): leads são "clientes em potencial",
 * mesma família core (VIEW_CUSTOMERS).
 *
 * Deep-link de notificação: `?lead=<id>` (ver `src/lib/notificationTarget.ts`)
 * muda o filtro para "Todos", salta para a página certa, expande e realça o
 * lead indicado — e marca-o como lido se ainda estiver "novo" (mesma regra do
 * expand manual, abaixo).
 */
export function LeadsInbox() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('lead')
  const { readOnly } = useWriteGuard()

  const [filter, setFilter] = useState<Filter>('new')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const handledHighlightRef = useRef<string | null>(null)
  const autoReadRef = useRef<Set<string>>(new Set())

  // Deep-link: uma notificação de lead traz `?lead=` — força "Todos" para o
  // lead aparecer independentemente do estado atual (pode já estar lido).
  useEffect(() => {
    if (highlightId) setFilter('all')
  }, [highlightId])

  const params: GetLeadsQueryParams | undefined = filter === 'all' ? undefined : { status: filter }
  const { data, isLoading, isError } = useGetLeads(params)
  // Contagem de "novos" para o badge do separador, independente do filtro ativo
  // (React Query partilha a cache pela mesma queryKey quando o filtro já é "new").
  const { data: newData } = useGetLeads({ status: 'new' })
  const newCount = newData?.count ?? 0
  const leads = data?.rows ?? []

  const pg = usePagination(leads, { resetKey: filter })

  const patchMut = usePatchLeadsId({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getLeadsQueryKey() }),
      onError: (e) => toast.error(getApiError(e, 'Não foi possível atualizar o lead.')),
    },
  })

  const markReadSilently = (id: string) => patchMut.mutate({ id, data: { status: 'read' } })
  const markRead = (id: string) =>
    patchMut.mutate({ id, data: { status: 'read' } }, { onSuccess: () => toast.success('Lead marcado como lido') })
  const archive = (id: string) =>
    patchMut.mutate({ id, data: { status: 'archived' } }, { onSuccess: () => toast.success('Lead arquivado') })

  const toggleExpand = (lead: Lead) => {
    const opening = expandedId !== lead.leadId
    setExpandedId(opening ? lead.leadId : null)
    if (opening && lead.status === 'new' && !readOnly && !autoReadRef.current.has(lead.leadId)) {
      autoReadRef.current.add(lead.leadId)
      markReadSilently(lead.leadId)
    }
  }

  // Uma vez a lista "Todos" carregada, localiza o lead do deep-link: expande-o,
  // marca-o como lido (se novo) e salta para a página onde ele cai.
  useEffect(() => {
    if (!highlightId || handledHighlightRef.current === highlightId) return
    const idx = leads.findIndex((l) => l.leadId === highlightId)
    if (idx === -1) return
    handledHighlightRef.current = highlightId
    const lead = leads[idx]
    setExpandedId(highlightId)
    if (lead.status === 'new' && !readOnly && !autoReadRef.current.has(lead.leadId)) {
      autoReadRef.current.add(lead.leadId)
      markReadSilently(lead.leadId)
    }
    pg.setPage(Math.floor(idx / PAGE_SIZE) + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, highlightId, readOnly])

  useEffect(() => {
    if (!highlightId || handledHighlightRef.current !== highlightId) return
    document.getElementById(`lead-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, pg.page])

  const emptyMeta = EMPTY_META[filter]

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <Tabs
          tabs={[
            { id: 'new', label: newCount > 0 ? `Novos (${newCount})` : 'Novos', icon: 'mail' },
            { id: 'all', label: 'Todos' },
            { id: 'archived', label: 'Arquivados', icon: 'folder' },
          ]}
          value={filter}
          onChange={(v: string) => setFilter(v as Filter)}
          size="sm"
        />
      </div>

      <div>
        {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        {isError && (
          <p className="px-4 sm:px-5 py-8 text-center text-red-500 text-sm">Erro ao carregar leads.</p>
        )}

        {!isLoading &&
          !isError &&
          pg.pageItems.map((lead) => {
            const expanded = expandedId === lead.leadId
            const long = lead.message.length > MESSAGE_TRUNCATE
            const shown = expanded || !long ? lead.message : `${lead.message.slice(0, MESSAGE_TRUNCATE)}…`
            return (
              <div
                key={lead.leadId}
                id={`lead-${lead.leadId}`}
                className={`p-4 sm:p-5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 transition-colors ${
                  highlightId === lead.leadId ? 'bg-accent/5 ring-1 ring-inset ring-accent/30' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleExpand(lead)}
                    className="min-w-0 flex-1 text-left rounded-lg -m-1 p-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-zinc-900 dark:text-white">{lead.name}</p>
                      <Badge tone={STATUS_TONE[lead.status]}>{STATUS_PT[lead.status]}</Badge>
                      {lead.source && <span className="text-xs text-zinc-400">via {lead.source}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500 mb-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="mail" className="w-3.5 h-3.5" />
                        {lead.email}
                      </span>
                      {lead.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="phone" className="w-3.5 h-3.5" />
                          {lead.phone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        {fmtDateTime(lead.createdAt)}
                      </span>
                    </div>
                    <p
                      data-testid={`lead-message-${lead.leadId}`}
                      className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap"
                    >
                      {shown}
                      {long && (
                        <span className="ml-1.5 text-accent text-xs font-medium">
                          {expanded ? 'Ver menos' : 'Ver mais'}
                        </span>
                      )}
                    </p>
                  </button>

                  <div className="flex sm:flex-col gap-2 shrink-0 pt-0.5">
                    {lead.status === 'new' && (
                      <GuardButton
                        size="sm"
                        variant="outline"
                        icon="check"
                        disabled={patchMut.isPending}
                        onClick={() => markRead(lead.leadId)}
                      >
                        Marcar como lida
                      </GuardButton>
                    )}
                    {lead.status !== 'archived' && (
                      <GuardButton
                        size="sm"
                        variant="outline"
                        icon="folder"
                        disabled={patchMut.isPending}
                        onClick={() => archive(lead.leadId)}
                      >
                        Arquivar
                      </GuardButton>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

        {!isLoading && !isError && leads.length === 0 && (
          <EmptyState icon="mail" title={emptyMeta.title} desc={emptyMeta.desc} />
        )}
        {!isLoading && !isError && leads.length > 0 && (
          <div className="px-4 sm:px-5 pb-1">
            <Pagination {...pg} />
          </div>
        )}
      </div>
    </Card>
  )
}
