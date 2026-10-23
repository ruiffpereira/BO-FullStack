import { type QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { invalidateMoney } from "../../lib/invalidateMoney";
import { BADGE_TONES } from "../../ui/ui.jsx";
import type { GymSubscription } from "../../gen/backoffice/types/GymSubscription.js";
import type { GymPayment } from "../../gen/backoffice/types/GymPayment.js";
import type { GymMembership } from "../../gen/backoffice/types/GymMembership.js";
import type { GymFinance } from "../../gen/backoffice/types/GymFinance.js";

// ── Tipos: gerados pelo Kubb a partir do spec (fim dos contratos à mão) ──────
export type Status = GymPayment['status']
export type Sub = GymSubscription
export type Payment = GymPayment
export type Membership = GymMembership
export type FinanceRow = GymFinance['rows'][number]
export type Finance = GymFinance

// ── Helpers de apresentação ──────────────────────────────────────────────────
export const EST: Record<Status, { t: string; tone: keyof typeof BADGE_TONES }> = {
  paid: { t: 'Pago', tone: 'green' },
  debt: { t: 'Em dívida', tone: 'amber' },
  unpaid: { t: 'Não pago', tone: 'neutral' },
}
// Tema visual por estado do mês (inclui "overdue", que é derivado na API e não persistido).
export const STATUS_VIEW: Record<'paid' | 'debt' | 'unpaid' | 'overdue', {
  label: string; tone: keyof typeof BADGE_TONES; icon: string; tint: string; fg: string; bar: string
}> = {
  paid: { label: 'Pago', tone: 'green', icon: 'check', tint: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  debt: { label: 'Em dívida', tone: 'amber', icon: 'clock', tint: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  overdue: { label: 'Em atraso', tone: 'red', icon: 'alertTriangle', tint: 'bg-red-50 dark:bg-red-500/10', fg: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  unpaid: { label: 'Não pago', tone: 'neutral', icon: 'euro', tint: 'bg-zinc-100 dark:bg-zinc-800', fg: 'text-zinc-500 dark:text-zinc-400', bar: 'bg-zinc-300 dark:bg-zinc-600' },
}
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const fmtPeriodo = (p?: string) => { if (!p) return '—'; const [y, m] = p.split('-'); return `${MES[+m - 1]} ${y}` }
const MES_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const fmtPeriodoLong = (p?: string) => { if (!p) return '—'; const [y, m] = p.split('-'); return `${MES_LONG[+m - 1]} ${y}` }
export const fmtData = (s?: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]} ${y}` }
const pad2 = (n: number) => String(n).padStart(2, '0')
export const shiftPeriod = (period: string, delta: number) => { const [y, m] = period.split('-').map(Number); const d = new Date(y, (m - 1) + delta, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` }
export const dueForPeriod = (period: string, dueDay = 8) => `${period}-${pad2(Math.min(28, Math.max(1, dueDay)))}`
export const daysUntil = (iso: string, today: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 86400000)
export const fmtDateTime = (iso?: string | null) => { if (!iso) return '—'; return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
export const currentPeriod = () => format(new Date(), 'yyyy-MM')

// Mensalidades mexem em dinheiro: invalida tudo o que o mostra (FI-05, `lib/invalidateMoney.ts`).
export const invalidateMens = (qc: QueryClient) => invalidateMoney(qc)
export const dueInput = 'bg-white dark:bg-zinc-900 border rounded-lg px-2 py-1 text-[13px] tabular-nums'
