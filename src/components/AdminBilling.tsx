import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Button, Badge, Modal, EmptyState } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { Combobox } from './Combobox'
import { getApiError } from '../lib/apiError'
import {
  useGetAdminBillingSubscriptions,
  getAdminBillingSubscriptionsQueryKey,
} from '../gen/backoffice/hooks/useGetAdminBillingSubscriptions'
import { usePostAdminBillingSubscriptions } from '../gen/backoffice/hooks/usePostAdminBillingSubscriptions'
import type { AdminBillingTenant } from '../gen/backoffice/types/AdminBillingTenant'
import type { PostAdminBillingSubscriptionsMutationRequestModulesEnum } from '../gen/backoffice/types/PostAdminBillingSubscriptions'
import { MODULE_LABELS, BILLABLE_MODULES, eur, statusBadge } from '../lib/billingStatus'

/**
 * Painel admin do dono da plataforma (Admin → tab "Faturação", `VIEW_ADMIN`, T6):
 * lista todos os tenants + o estado da subscrição da plataforma, e permite CRIAR
 * uma subscrição (escolhe módulos → dispara `createTenantSubscription` na API). O
 * cartão é adicionado pelo tenant depois (via Billing Portal / Checkout) — aqui só
 * se cria a subscrição em trial.
 */

type Module = PostAdminBillingSubscriptionsMutationRequestModulesEnum

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[34rem]">{children}</table>
      </div>
    </div>
  )
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${60 + j * 8}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function CreateSubscriptionModal({
  open,
  onClose,
  tenants,
}: {
  open: boolean
  onClose: () => void
  tenants: AdminBillingTenant[]
}) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState('')
  const [modules, setModules] = useState<Module[]>([])

  const createM = usePostAdminBillingSubscriptions({
    mutation: {
      onSuccess: (res) => {
        toast.success(
          res?.reused
            ? 'Subscrição atualizada. O tenant recebe indicação para adicionar o cartão.'
            : 'Subscrição criada. O tenant recebe indicação para adicionar o cartão.',
        )
        qc.invalidateQueries({ queryKey: getAdminBillingSubscriptionsQueryKey() })
        setUserId('')
        setModules([])
        onClose()
      },
      onError: (error) => {
        const status = (error as any)?.response?.status ?? (error as any)?.status
        if (status === 402) {
          toast.error('Cobrança travada até à faturação certificada — usa uma chave Stripe de teste.')
        } else if (status === 404) {
          toast.error('Tenant não encontrado.')
        } else {
          toast.error(getApiError(error, 'Não foi possível criar a subscrição.'))
        }
      },
    },
  })

  const toggleModule = (m: Module) =>
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const tenantOptions = useMemo(
    () =>
      tenants.map((t) => ({
        value: t.userId,
        label: t.subscription ? `${t.name} — ${t.email} (já tem subscrição)` : `${t.name} — ${t.email}`,
      })),
    [tenants],
  )

  const submit = () => {
    if (!userId) {
      toast.error('Escolhe um tenant.')
      return
    }
    if (modules.length === 0) {
      toast.error('Escolhe pelo menos um módulo.')
      return
    }
    createM.mutate({ data: { userId, modules } })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar subscrição"
      subtitle="Cria uma subscrição da plataforma (trial de 14 dias) para um tenant."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={createM.isPending} onClick={submit}>
            {createM.isPending ? 'A criar…' : 'Criar subscrição'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Combobox
          label="Tenant"
          value={userId}
          onChange={setUserId}
          options={tenantOptions}
          placeholder="Escolher tenant…"
          searchPlaceholder="Pesquisar por nome ou email…"
        />

        <div>
          <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Módulos a cobrar</p>
          <div className="space-y-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
            {BILLABLE_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modules.includes(m)}
                  onChange={() => toggleModule(m)}
                  className="rounded border-zinc-300 text-accent focus:ring-accent/20"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-200">{MODULE_LABELS[m]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-3.5 py-3">
          <Icon name="info" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Ao criar, o tenant recebe indicação para adicionar o cartão no portal seguro do Stripe. A cobrança só
            arranca no fim do período de teste.
          </p>
        </div>
      </div>
    </Modal>
  )
}

export function AdminBillingTab() {
  const { data: tenants = [], isLoading } = useGetAdminBillingSubscriptions()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon="plus" size="sm" onClick={() => setCreateOpen(true)}>
          Criar subscrição
        </Button>
      </div>

      {!isLoading && tenants.length === 0 ? (
        <Card className="p-2">
          <EmptyState
            icon="card"
            title="Sem tenants"
            desc="Quando houver tenants, o estado da subscrição da plataforma de cada um aparece aqui."
          />
        </Card>
      ) : (
        <TableWrapper>
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 hidden md:table-cell">Módulos</th>
              <th className="px-4 py-3 text-right">Total/mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {isLoading ? (
              <SkeletonRows cols={4} />
            ) : (
              tenants.map((t) => {
                const sub = t.subscription
                const badge = sub ? statusBadge(sub.status) : null
                return (
                  <tr key={t.userId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-zinc-900 dark:text-white">{t.name}</div>
                      <div className="text-xs text-zinc-400">{t.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {badge ? (
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      ) : (
                        <Badge tone="neutral">Sem subscrição</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {sub && sub.modules.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.modules.map((m) => (
                            <Badge key={m} tone="neutral">
                              {MODULE_LABELS[m] ?? m}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                      {sub ? eur.format(sub.monthlyTotalEur) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </TableWrapper>
      )}

      <CreateSubscriptionModal open={createOpen} onClose={() => setCreateOpen(false)} tenants={tenants} />
    </div>
  )
}
