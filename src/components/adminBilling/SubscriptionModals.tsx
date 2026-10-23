import { fmtEur } from "../../lib/money";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Badge, Modal, Input } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import { Combobox } from "../Combobox";
import { getApiError } from "../../lib/apiError";
import { getAdminBillingSubscriptionsQueryKey } from "../../gen/backoffice/hooks/useGetAdminBillingSubscriptions";
import { usePostAdminBillingSubscriptions } from "../../gen/backoffice/hooks/usePostAdminBillingSubscriptions";
import { getAdminBillingCatalogQueryKey } from "../../gen/backoffice/hooks/useGetAdminBillingCatalog";
import { usePatchAdminBillingSubscriptionsUseridTrial } from "../../gen/backoffice/hooks/usePatchAdminBillingSubscriptionsUseridTrial";
import type { AdminBillingTenant } from "../../gen/backoffice/types/AdminBillingTenant";
import type { BillingCatalogModule } from "../../gen/backoffice/types/BillingCatalogModule";
import { MODULE_LABELS, BILLABLE_MODULES, centsToEurInput, parseEurToCents, fmtLongDate } from "../../lib/billingStatus";
import { Module } from "../AdminBilling";

// ── Criar subscrição (com override de preço por módulo) ─────────────────────────

export function CreateSubscriptionModal({
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
        const total = fmtEur(res?.monthlyTotalEur ?? 0)
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
                        {fmtEur(entry.monthlyAmountEur)}/mês
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

// ── Estender trial (self-serve, T10) ────────────────────────────────────────

/**
 * Ação "Estender trial" — só faz sentido para subscrições em `trialing` (o
 * único estado local em que a lista admin ainda não distingue trial self-serve
 * de trial Stripe-backed; a API resolve a diferença: 409 se for gerida pelo
 * Stripe, apontando para o Billing Portal). `trial_expired` (T9) partilha o
 * mesmo `status: "trialing"` na BD — a expiração é só um `reason` derivado no
 * `GET /billing/subscription` do próprio tenant, não fica na lista admin.
 */
export function ExtendTrialModal({
  open,
  onClose,
  tenant,
}: {
  open: boolean
  onClose: () => void
  tenant: AdminBillingTenant | null
}) {
  const qc = useQueryClient()
  const [daysStr, setDaysStr] = useState('14')

  useEffect(() => {
    if (open) setDaysStr('14')
  }, [open, tenant?.userId])

  const extendM = usePatchAdminBillingSubscriptionsUseridTrial({
    mutation: {
      onSuccess: (res) => {
        toast.success(`Trial estendido — novo fim a ${fmtLongDate(res?.trialEnd)}.`)
        qc.invalidateQueries({ queryKey: getAdminBillingSubscriptionsQueryKey() })
        qc.invalidateQueries({ queryKey: getAdminBillingCatalogQueryKey() })
        onClose()
      },
      onError: (error) => {
        const status = (error as any)?.response?.status ?? (error as any)?.status
        if (status === 409) {
          toast.error('Subscrição gerida pelo Stripe — usa o Billing Portal para alterar o período.')
        } else if (status === 404) {
          toast.error('Tenant sem subscrição.')
        } else {
          toast.error(getApiError(error, 'Não foi possível estender o período experimental.'))
        }
      },
    },
  })

  const days = Number(daysStr)
  const valid = daysStr.trim() !== '' && Number.isInteger(days) && days >= 1 && days <= 90

  const submit = () => {
    if (!tenant || !valid) return
    extendM.mutate({ userId: tenant.userId, data: { days } })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Estender trial"
      subtitle={tenant ? `${tenant.name} — período experimental local` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valid || extendM.isPending} onClick={submit}>
            {extendM.isPending ? 'A estender…' : 'Estender'}
          </Button>
        </>
      }
    >
      <Input
        label="Dias a acrescentar"
        aria-label="Dias a acrescentar"
        type="number"
        min={1}
        max={90}
        value={daysStr}
        onChange={(e) => setDaysStr(e.target.value)}
        hint="Soma-se ao fim do trial atual (ou a partir de agora, se já tiver expirado)."
      />
      {!valid && <span className="block text-xs text-red-500 mt-1">Introduz um número entre 1 e 90.</span>}
    </Modal>
  )
}
