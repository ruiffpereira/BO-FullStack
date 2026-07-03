import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Button, Badge, Modal, EmptyState, Input, Toggle, SectionTitle } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { Combobox } from './Combobox'
import { getApiError } from '../lib/apiError'
import {
  useGetAdminBillingSubscriptions,
  getAdminBillingSubscriptionsQueryKey,
} from '../gen/backoffice/hooks/useGetAdminBillingSubscriptions'
import { usePostAdminBillingSubscriptions } from '../gen/backoffice/hooks/usePostAdminBillingSubscriptions'
import {
  useGetAdminBillingCatalog,
  getAdminBillingCatalogQueryKey,
} from '../gen/backoffice/hooks/useGetAdminBillingCatalog'
import { usePutAdminBillingCatalogModule } from '../gen/backoffice/hooks/usePutAdminBillingCatalogModule'
import type { AdminBillingTenant } from '../gen/backoffice/types/AdminBillingTenant'
import type { BillingCatalogModule } from '../gen/backoffice/types/BillingCatalogModule'
import type { PostAdminBillingSubscriptionsMutationRequestModulesEnum } from '../gen/backoffice/types/PostAdminBillingSubscriptions'
import {
  MODULE_LABELS,
  BILLABLE_MODULES,
  eur,
  statusBadge,
  centsToEurInput,
  parseEurToCents,
} from '../lib/billingStatus'

/**
 * Painel admin do dono da plataforma (Admin → tab "Faturação", `VIEW_ADMIN`, T6 +
 * Fatia 2 do redesign de preços):
 *  - CATÁLOGO de preços dos módulos (agenda/gym/loja): o dono edita o preço mensal
 *    (em €) e o estado ativo/inativo de cada módulo — persistido via
 *    `PUT /admin/billing/catalog/:module` (a API fala em cêntimos; convertemos na
 *    fronteira). Os preços NUNCA são hardcoded no frontend — vêm do catálogo.
 *  - LISTA de tenants + estado da subscrição da plataforma, e criação de
 *    subscrições (escolhe módulos, com override de preço opcional por módulo →
 *    `items: [{ module, amountCents? }]`). O cartão é adicionado pelo tenant depois
 *    (Billing Portal / Checkout) — aqui só se cria a subscrição em trial.
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

// ── Catálogo de preços ────────────────────────────────────────────────────────

/** Uma linha editável do catálogo: label + preço/mês (€) + toggle ativo + Guardar. */
function CatalogRow({ row }: { row: BillingCatalogModule }) {
  const qc = useQueryClient()
  const [priceStr, setPriceStr] = useState(() => centsToEurInput(row.monthlyAmountCents))
  const [active, setActive] = useState(row.active)

  // Re-sincroniza os campos quando os dados do servidor mudam (ex.: após guardar
  // e invalidar a query) — o input segue o valor autoritativo da API.
  useEffect(() => {
    setPriceStr(centsToEurInput(row.monthlyAmountCents))
    setActive(row.active)
  }, [row.monthlyAmountCents, row.active])

  const putM = usePutAdminBillingCatalogModule({
    mutation: {
      onSuccess: () => {
        toast.success(`${row.label}: preço atualizado.`)
        qc.invalidateQueries({ queryKey: getAdminBillingCatalogQueryKey() })
        qc.invalidateQueries({ queryKey: getAdminBillingSubscriptionsQueryKey() })
      },
      onError: (error) => toast.error(getApiError(error, 'Não foi possível guardar o preço.')),
    },
  })

  const parsedCents = parseEurToCents(priceStr)
  const priceInvalid = parsedCents === null
  const dirty = (parsedCents !== null && parsedCents !== row.monthlyAmountCents) || active !== row.active

  const save = () => {
    if (parsedCents === null) {
      toast.error('Preço inválido.')
      return
    }
    putM.mutate({ module: row.module, data: { monthlyAmountCents: parsedCents, active } })
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 py-3.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 last:pb-0">
      <div className="sm:w-40 min-w-0 sm:pb-2">
        <div className="font-medium text-zinc-900 dark:text-white truncate">{row.label}</div>
        <div className="text-xs text-zinc-400 font-mono">{row.module}</div>
      </div>

      <div className="sm:w-44">
        <Input
          label="Preço /mês (€)"
          icon="euro"
          inputMode="decimal"
          value={priceStr}
          onChange={(e) => setPriceStr(e.target.value)}
          aria-label={`Preço de ${row.label}`}
          className="tabular-nums"
        />
        {priceInvalid && <span className="block text-xs text-red-500 mt-1">Valor inválido.</span>}
      </div>

      <label className="flex items-center gap-2 sm:pb-2">
        <Toggle checked={active} onChange={setActive} />
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{active ? 'Ativo' : 'Inativo'}</span>
      </label>

      <div className="sm:ml-auto sm:pb-1">
        <Button
          size="sm"
          variant="outline"
          icon="check"
          aria-label={`Guardar ${row.label}`}
          disabled={!dirty || priceInvalid || putM.isPending}
          onClick={save}
        >
          {putM.isPending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}

function CatalogEditor({ rows, loading }: { rows: BillingCatalogModule[]; loading: boolean }) {
  return (
    <Card className="p-5">
      <SectionTitle>Catálogo de preços dos módulos</SectionTitle>
      <p className="text-sm text-zinc-500 mb-2">
        O preço mensal de cada módulo. Alterar aqui afeta apenas subscrições novas — as existentes mantêm o preço já
        fixado no Stripe.
      </p>

      {loading ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-400 py-2">Sem módulos no catálogo.</p>
      ) : (
        <div>
          {rows.map((row) => (
            <CatalogRow key={row.module} row={row} />
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Criar subscrição (com override de preço por módulo) ─────────────────────────

function CreateSubscriptionModal({
  open,
  onClose,
  tenants,
  catalog,
}: {
  open: boolean
  onClose: () => void
  tenants: AdminBillingTenant[]
  catalog: BillingCatalogModule[]
}) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState('')
  const [modules, setModules] = useState<Module[]>([])
  // Override de preço por módulo (texto em €). Vazio = usar o preço do catálogo.
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const catalogByModule = useMemo(
    () => Object.fromEntries(catalog.map((c) => [c.module, c])) as Record<string, BillingCatalogModule>,
    [catalog],
  )

  const reset = () => {
    setUserId('')
    setModules([])
    setOverrides({})
  }

  // Fechar/cancelar SEMPRE limpa o formulário (tenant + módulos + overrides de
  // preço) — reabrir o modal começa sempre em branco. Sem isto, um override
  // deixado num cancelamento reaparecia no próximo tenant (footgun de cobrança).
  const closeAndReset = () => {
    reset()
    onClose()
  }

  const createM = usePostAdminBillingSubscriptions({
    mutation: {
      onSuccess: (res) => {
        const total = eur.format(res?.monthlyTotalEur ?? 0)
        toast.success(
          `${res?.reused ? 'Subscrição atualizada' : 'Subscrição criada'} — ${total}/mês. O tenant recebe indicação para adicionar o cartão.`,
        )
        qc.invalidateQueries({ queryKey: getAdminBillingSubscriptionsQueryKey() })
        reset()
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
    // Valida overrides preenchidos ANTES de submeter (a API também valida → 400).
    for (const m of modules) {
      const raw = (overrides[m] ?? '').trim()
      if (raw && parseEurToCents(raw) === null) {
        toast.error(`Preço inválido para ${MODULE_LABELS[m] ?? m}.`)
        return
      }
    }
    // Forma canónica: items:[{ module, amountCents? }]. Sem override (campo vazio) →
    // envia só o módulo → a API usa o preço-base do catálogo.
    const items = modules.map((m) => {
      const raw = (overrides[m] ?? '').trim()
      const cents = raw ? parseEurToCents(raw) : null
      return cents !== null ? { module: m, amountCents: cents } : { module: m }
    })
    createM.mutate({ data: { userId, items } })
  }

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      title="Criar subscrição"
      subtitle="Cria uma subscrição da plataforma (trial de 14 dias) para um tenant."
      footer={
        <>
          <Button variant="ghost" onClick={closeAndReset}>
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
          <div className="space-y-2 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
            {BILLABLE_MODULES.map((m) => {
              const entry = catalogByModule[m]
              const inactive = entry ? !entry.active : false
              const checked = modules.includes(m)
              return (
                <div key={m} className="space-y-1.5">
                  {/* Preço/badge FORA do <label> — o nome acessível do checkbox fica só o módulo. */}
                  <div className="flex items-center gap-2.5">
                    <label className={`flex items-center gap-2.5 ${inactive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={inactive}
                        onChange={() => toggleModule(m)}
                        className="rounded border-zinc-300 text-accent focus:ring-accent/20"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-200">{MODULE_LABELS[m] ?? m}</span>
                    </label>
                    {entry && (
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {eur.format(entry.monthlyAmountEur)}/mês
                      </span>
                    )}
                    {inactive && <Badge tone="neutral">Inativo</Badge>}
                  </div>

                  {checked && (
                    <div className="pl-7">
                      <Input
                        label="Preço personalizado (€)"
                        icon="euro"
                        inputMode="decimal"
                        value={overrides[m] ?? ''}
                        onChange={(e) => setOverrides((cur) => ({ ...cur, [m]: e.target.value }))}
                        placeholder={entry ? centsToEurInput(entry.monthlyAmountCents) : undefined}
                        aria-label={`Preço personalizado de ${MODULE_LABELS[m] ?? m}`}
                        hint="Deixa vazio para usar o preço do catálogo."
                        className="tabular-nums"
                      />
                    </div>
                  )}
                </div>
              )
            })}
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
  const { data: catalog = [], isLoading: catalogLoading } = useGetAdminBillingCatalog()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <CatalogEditor rows={catalog} loading={catalogLoading} />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Subscrições dos tenants</h2>
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
      </div>

      <CreateSubscriptionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenants={tenants}
        catalog={catalog}
      />
    </div>
  )
}
