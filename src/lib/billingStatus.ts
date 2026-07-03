// Helpers partilhados do platform billing (subscrição da plataforma por tenant).
// Usados pela página Faturação (tenant, T4/T5), pelo banner (Shell, T5) e pelo
// painel admin do dono (Admin, T6). Uma só fonte de verdade para labels, formatos
// e o mapa estado→badge — sem duplicar entre páginas.

export type BillingTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red'

// A API só devolve o total mensal (soma) — os preços por módulo vivem no Stripe e
// não chegam ao browser. Mostramos os nomes dos módulos + o total autoritativo.
export const MODULE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  gym: 'Ginásio',
  loja: 'Loja',
}

/** Módulos cobráveis (catálogo fechado — igual ao enum do spec). */
export const BILLABLE_MODULES = ['agenda', 'gym', 'loja'] as const
export type BillableModule = (typeof BILLABLE_MODULES)[number]

export const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

/** ISO date-time → "16 de julho de 2026" (pt-PT). */
export function fmtLongDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Badge por `reason` (página Faturação — a `reason` é mais rica que o `status`:
// distingue grace de locked). Trial usa a família accent (blue neste tema).
export const REASON_BADGE: Record<string, { tone: BillingTone; label: string }> = {
  none: { tone: 'neutral', label: 'Sem subscrição' },
  trialing: { tone: 'blue', label: 'Período de teste' },
  active: { tone: 'green', label: 'Ativa' },
  incomplete: { tone: 'amber', label: 'Por concluir' },
  grace: { tone: 'amber', label: 'Pagamento em atraso' },
  past_due_locked: { tone: 'red', label: 'Acesso limitado' },
  canceled: { tone: 'red', label: 'Cancelada' },
}
export const reasonBadge = (reason: string) => REASON_BADGE[reason] ?? REASON_BADGE.none

// Badge por `status` do Stripe (painel admin — a lista só traz o status bruto,
// sem os derivados da política de acesso).
export const STATUS_BADGE: Record<string, { tone: BillingTone; label: string }> = {
  trialing: { tone: 'blue', label: 'Período de teste' },
  active: { tone: 'green', label: 'Ativa' },
  past_due: { tone: 'amber', label: 'Em atraso' },
  canceled: { tone: 'red', label: 'Cancelada' },
  incomplete: { tone: 'amber', label: 'Por concluir' },
}
export const statusBadge = (status: string) =>
  STATUS_BADGE[status] ?? { tone: 'neutral' as BillingTone, label: status }
