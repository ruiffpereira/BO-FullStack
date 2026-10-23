import { fmtEur } from "../lib/money";
import { useState } from "react";
import { Card, Button, Badge, EmptyState } from "../ui/ui.jsx";
import { useGetAdminBillingSubscriptions } from "../gen/backoffice/hooks/useGetAdminBillingSubscriptions";
import { useGetAdminBillingCatalog } from "../gen/backoffice/hooks/useGetAdminBillingCatalog";
import type { AdminBillingTenant } from "../gen/backoffice/types/AdminBillingTenant";
import type { PostAdminBillingSubscriptionsMutationRequestModulesEnum } from "../gen/backoffice/types/PostAdminBillingSubscriptions";
import { MODULE_LABELS, statusBadge } from "../lib/billingStatus";
import { CatalogEditor } from "./adminBilling/Catalog";
import { TrialSettingsEditor } from "./adminBilling/TrialSettingsEditor";
import { CreateSubscriptionModal, ExtendTrialModal } from "./adminBilling/SubscriptionModals";

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

export type Module = PostAdminBillingSubscriptionsMutationRequestModulesEnum

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

export function AdminBillingTab() {
  const { data: tenants = [], isLoading } = useGetAdminBillingSubscriptions()
  const { data: catalog = [], isLoading: catalogLoading } = useGetAdminBillingCatalog()
  const [createOpen, setCreateOpen] = useState(false)
  const [extendingTenant, setExtendingTenant] = useState<AdminBillingTenant | null>(null)

  return (
    <div className="space-y-6">
      <CatalogEditor rows={catalog} loading={catalogLoading} />
      <TrialSettingsEditor />

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
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {isLoading ? (
                <SkeletonRows cols={5} />
              ) : (
                tenants.map((t) => {
                  const sub = t.subscription
                  const badge = sub ? statusBadge(sub.status) : null
                  // Estender trial só faz sentido em trialing (self-serve local OU
                  // trial_expired — ambos ficam com este `status` na BD; a API
                  // devolve 409 se afinal for gerido pelo Stripe).
                  const canExtendTrial = sub?.status === 'trialing'
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
                        {sub ? fmtEur(sub.monthlyTotalEur) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canExtendTrial && (
                          <Button size="sm" variant="outline" onClick={() => setExtendingTenant(t)}>
                            Estender trial
                          </Button>
                        )}
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
      <ExtendTrialModal
        open={!!extendingTenant}
        onClose={() => setExtendingTenant(null)}
        tenant={extendingTenant}
      />
    </div>
  )
}
