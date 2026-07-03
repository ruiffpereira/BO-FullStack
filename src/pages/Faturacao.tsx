import { toast } from 'sonner'
import { Card, PageHeader, EmptyState, Button, Badge, SectionTitle } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { useGetBillingSubscription } from '../gen/backoffice/hooks/useGetBillingSubscription'

/**
 * Página "Faturação" (core, todos os tenants). Cada tenant vê a SUA subscrição
 * da plataforma (platform billing, T4). Só leitura do estado — o gate de escrita
 * (banner + read-only guard) é a T5 e o painel de criação do dono é a T6.
 *
 * O endpoint (`GET /api/billing/subscription`, `authenticateToken`) devolve o
 * estado + os derivados da política de acesso. Estados cobertos: sem subscrição
 * (`none`) · período de teste (`trialing`) · ativa (`active`) · pagamento em
 * atraso dentro do grace (`past_due`/reason `grace`) · acesso limitado a leitura
 * (`past_due_locked`/`canceled`) · por concluir (`incomplete`).
 */

// A API só devolve o total mensal (soma) — os preços por módulo vivem no Stripe
// e não chegam ao browser. Mostramos os nomes dos módulos + o total autoritativo.
const MODULE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  gym: 'Ginásio',
  loja: 'Loja',
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

/** ISO date-time → "16 de julho de 2026" (pt-PT). */
function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red'

// Badge (cabeçalho) por estado. Chaveado pela `reason` (mais rica que `status`:
// distingue grace de locked). Trial usa a família accent (blue neste tema).
const BADGE_VIEW: Record<string, { tone: Tone; label: string }> = {
  none: { tone: 'neutral', label: 'Sem subscrição' },
  trialing: { tone: 'blue', label: 'Período de teste' },
  active: { tone: 'green', label: 'Ativa' },
  incomplete: { tone: 'amber', label: 'Por concluir' },
  grace: { tone: 'amber', label: 'Pagamento em atraso' },
  past_due_locked: { tone: 'red', label: 'Acesso limitado' },
  canceled: { tone: 'red', label: 'Cancelada' },
}

const NOTICE_BORDER: Record<Tone, string> = {
  neutral: 'border-zinc-200 dark:border-zinc-800',
  blue: 'border-blue-200 dark:border-blue-900/50',
  green: 'border-emerald-200 dark:border-emerald-900/50',
  amber: 'border-amber-200 dark:border-amber-900/50',
  red: 'border-red-200 dark:border-red-900/50',
}
const NOTICE_ICON: Record<Tone, string> = {
  neutral: 'text-zinc-400',
  blue: 'text-blue-500',
  green: 'text-emerald-500',
  amber: 'text-amber-500',
  red: 'text-red-500',
}

// TODO(T6): substituir pelo endpoint que cria a sessão do Stripe Customer Portal
// (`POST /api/billing/portal` → redirect). Enquanto não existir, o CTA é um stub.
function openBillingPortal() {
  toast.info('A gestão de pagamento (portal Stripe) fica disponível em breve.')
}

/** Callout colorido com ícone + título + descrição + ação opcional. */
function Notice({
  tone,
  icon,
  role,
  title,
  desc,
  action,
}: {
  tone: Tone
  icon: string
  role: 'status' | 'alert'
  title: string
  desc?: string
  action?: boolean
}) {
  return (
    <Card role={role} className={`p-4 flex items-start gap-3 ${NOTICE_BORDER[tone]}`}>
      <Icon name={icon} className={`w-5 h-5 shrink-0 mt-0.5 ${NOTICE_ICON[tone]}`} />
      <div className="text-sm min-w-0 flex-1">
        <p className="font-medium text-zinc-800 dark:text-zinc-100">{title}</p>
        {desc && <p className="text-zinc-500 mt-0.5">{desc}</p>}
        {action && (
          <Button size="sm" variant="outline" icon="card" className="mt-3" onClick={openBillingPortal}>
            Regularizar pagamento
          </Button>
        )}
      </div>
    </Card>
  )
}

export function Faturacao() {
  const { data, isLoading, isError } = useGetBillingSubscription()

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="Faturação" subtitle="A tua subscrição da plataforma.">
        {data && <Badge tone={(BADGE_VIEW[data.reason] ?? BADGE_VIEW.none).tone}>{(BADGE_VIEW[data.reason] ?? BADGE_VIEW.none).label}</Badge>}
      </PageHeader>

      {isLoading && (
        <Card className="p-5 space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </Card>
      )}

      {!isLoading && isError && (
        <Card role="status" className={`p-4 flex items-start gap-3 ${NOTICE_BORDER.amber}`}>
          <Icon name="info" className={`w-5 h-5 shrink-0 mt-0.5 ${NOTICE_ICON.amber}`} />
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Não foi possível carregar a subscrição</p>
            <p className="text-zinc-500 mt-0.5">Tenta novamente daqui a pouco. Se o problema persistir, fala com o suporte.</p>
          </div>
        </Card>
      )}

      {!isLoading && !isError && data && (
        data.status === 'none' ? (
          <Card className="p-2">
            <EmptyState
              icon="card"
              title="Sem subscrição ativa"
              desc="Ainda não tens uma subscrição da plataforma ativa. Quando tiveres, o plano e o método de pagamento aparecem aqui."
            />
          </Card>
        ) : (
          <>
            {/* Aviso de estado (trial / por concluir / em atraso / limitado / cancelado) */}
            {data.reason === 'trialing' && (
              <Notice
                tone="blue"
                icon="clock"
                role="status"
                title={`Período de teste — termina a ${fmtDate(data.trialEnd)}.`}
                desc="No fim do período, a subscrição é cobrada automaticamente ao método de pagamento. Confirma que o teu cartão está registado."
              />
            )}
            {data.reason === 'incomplete' && (
              <Notice
                tone="amber"
                icon="alertTriangle"
                role="status"
                title="Subscrição por concluir."
                desc="Adiciona um método de pagamento para ativares a subscrição."
                action
              />
            )}
            {data.reason === 'grace' && (
              <Notice
                tone="amber"
                icon="alertTriangle"
                role="status"
                title={`Pagamento em atraso — regulariza até ${fmtDate(data.graceEndsAt)} para manteres o acesso.`}
                desc="Depois desta data, a gestão fica limitada a leitura até regularizares. Nenhum dado é apagado."
                action
              />
            )}
            {data.reason === 'past_due_locked' && (
              <Notice
                tone="red"
                icon="lock"
                role="alert"
                title="Acesso limitado a leitura — regulariza o pagamento."
                desc="Os teus dados estão seguros. Assim que o pagamento for regularizado, o acesso completo volta de imediato."
                action
              />
            )}
            {data.reason === 'canceled' && (
              <Notice
                tone="red"
                icon="ban"
                role="alert"
                title="Subscrição cancelada — acesso limitado a leitura."
                desc="Regulariza o pagamento para reativar a subscrição. Nenhum dado é apagado."
                action
              />
            )}

            {/* O teu plano: módulos cobrados + total/mês */}
            <Card className="p-5">
              <SectionTitle>O teu plano</SectionTitle>
              {data.modules.length > 0 ? (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.modules.map((m) => (
                    <li key={m} className="flex items-center gap-2.5 py-2.5 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      <span className="text-zinc-700 dark:text-zinc-200">{MODULE_LABELS[m] ?? m}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400 py-2">Sem módulos cobrados.</p>
              )}

              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
                <span className="text-sm font-medium text-zinc-500">Total</span>
                <span className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">
                  {eur.format(data.monthlyTotalEur ?? 0)}
                  <span className="text-sm font-normal text-zinc-400"> /mês</span>
                </span>
              </div>

              {data.status === 'active' && data.currentPeriodEnd && (
                <p className="mt-2 text-[13px] text-zinc-500">Próxima renovação: {fmtDate(data.currentPeriodEnd)}.</p>
              )}
              {data.cancelAt && (
                <p className="mt-2 text-[13px] text-zinc-500">A subscrição cancela a {fmtDate(data.cancelAt)}.</p>
              )}
            </Card>

            {/* Método de pagamento → Stripe Customer Portal (stub até T6) */}
            <Card className="p-5">
              <SectionTitle>Método de pagamento</SectionTitle>
              <p className="text-sm text-zinc-500">
                Gere o cartão, descarrega faturas ou cancela no portal seguro do Stripe.
              </p>
              <Button variant="outline" icon="card" className="mt-3" onClick={openBillingPortal}>
                Gerir pagamento
              </Button>
            </Card>
          </>
        )
      )}
    </div>
  )
}
