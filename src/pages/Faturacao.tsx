import { toast } from 'sonner'
import { Card, PageHeader, EmptyState, Button, Badge, SectionTitle } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { usePageSubtitle } from '../context/PageMetaContext'
import { getApiError } from '../lib/apiError'
import { useGetBillingSubscription } from '../gen/backoffice/hooks/useGetBillingSubscription'
import { usePostBillingPortal } from '../gen/backoffice/hooks/usePostBillingPortal'
import { usePostBillingSubscribe } from '../gen/backoffice/hooks/usePostBillingSubscribe'
import {
  MODULE_LABELS,
  eur,
  fmtLongDate as fmtDate,
  reasonBadge,
  type BillingTone as Tone,
} from '../lib/billingStatus'

/**
 * Página "Faturação" (core, todos os tenants). Cada tenant vê a SUA subscrição
 * da plataforma (platform billing, T4/T5/T9). Estados cobertos: sem subscrição
 * (`none`) · período de teste (`trialing`) · ativa (`active`) · pagamento em
 * atraso dentro do grace (`grace`) · acesso limitado a leitura (`past_due_locked`/
 * `canceled`) · por concluir (`incomplete`) · trial local terminado (`trial_expired`).
 *
 * O CTA "Gerir pagamento" abre uma sessão do **Stripe Billing Portal**
 * (`POST /api/billing/portal` → redireciona para gerir cartão/faturas/cancelamento)
 * — só faz sentido quando já existe uma subscrição Stripe REAL por trás
 * (`hasStripeSubscription`).
 *
 * O CTA de self-serve "Adicionar cartão" (T9) cria uma **Stripe Checkout Session**
 * (`POST /api/billing/subscribe` → `{ url }`, redirect) para o tenant introduzir o
 * cartão e converter o trial local numa subscrição Stripe real. Só se mostra
 * quando `!hasStripeSubscription` (trial local, nunca teve Stripe por trás) OU o
 * estado é `canceled` (reativação — o Billing Portal não ressuscita uma
 * subscrição Stripe já cancelada; o self-serve cria uma nova). Ver
 * `canSelfServeSubscribe` abaixo.
 */

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

type NoticeAction = { onClick: () => void; pending?: boolean; label?: string; icon?: string }

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
  action?: NoticeAction
}) {
  return (
    <Card role={role} className={`p-4 flex items-start gap-3 ${NOTICE_BORDER[tone]}`}>
      <Icon name={icon} className={`w-5 h-5 shrink-0 mt-0.5 ${NOTICE_ICON[tone]}`} />
      <div className="text-sm min-w-0 flex-1">
        <p className="font-medium text-zinc-800 dark:text-zinc-100">{title}</p>
        {desc && <p className="text-zinc-500 mt-0.5">{desc}</p>}
        {action && (
          <Button
            size="sm"
            variant="outline"
            icon={action.icon ?? 'card'}
            className="mt-3"
            disabled={action.pending}
            onClick={action.onClick}
          >
            {action.pending ? 'A abrir…' : action.label ?? 'Regularizar pagamento'}
          </Button>
        )}
      </div>
    </Card>
  )
}

export function Faturacao() {
  const { data, isLoading, isError } = useGetBillingSubscription()

  // Abre o Stripe Billing Portal e redireciona o tenant. 409 = ainda sem
  // cliente/subscrição Stripe (o dono ainda não criou a subscrição — T6).
  const portalM = usePostBillingPortal({
    mutation: {
      onSuccess: (session) => {
        if (session?.url) window.location.href = session.url
      },
      onError: (error) => {
        const status = (error as any)?.response?.status ?? (error as any)?.status
        if (status === 409) {
          toast.error('Ainda não tens um método de pagamento associado — fala com o suporte.')
        } else {
          toast.error(getApiError(error, 'Não foi possível abrir a gestão de pagamento.'))
        }
      },
    },
  })
  const portalAction: NoticeAction = { onClick: () => portalM.mutate(), pending: portalM.isPending }

  // Self-serve (T9): cria a Stripe Checkout Session e redireciona o tenant para
  // introduzir o cartão. 400 = sem módulos/config em falta; 402 = cobrança
  // bloqueada (BILLING_LIVE); 409 = já tem uma subscrição Stripe viva (usar o
  // botão "Gerir pagamento" acima, não duplicado aqui).
  const subscribeM = usePostBillingSubscribe({
    mutation: {
      onSuccess: (session) => {
        if (session?.url) window.location.href = session.url
      },
      onError: (error) => {
        const status = (error as any)?.response?.status ?? (error as any)?.status
        if (status === 409) {
          toast.error('Já tens uma subscrição em curso — usa "Gerir pagamento" para a atualizar.')
        } else if (status === 402) {
          toast.error(getApiError(error, 'Cobrança ainda não disponível — fala com o suporte.'))
        } else {
          toast.error(getApiError(error, 'Não foi possível iniciar a subscrição.'))
        }
      },
    },
  })
  const subscribeAction: NoticeAction = {
    onClick: () => subscribeM.mutate(),
    pending: subscribeM.isPending,
    label: 'Adicionar cartão',
    icon: 'card',
  }

  // Só faz sentido oferecer o self-serve (Checkout Session) quando NÃO existe
  // uma subscrição Stripe real por trás (trial local — signup self-serve) OU
  // quando já está `canceled` (o Billing Portal não reativa uma subscrição
  // Stripe cancelada; o self-serve cria uma nova). Nos restantes estados
  // (Stripe-backed: trialing com cartão, incomplete, grace, past_due_locked,
  // active) o caminho certo é sempre o Billing Portal.
  const canSelfServeSubscribe = !!data && (!data.hasStripeSubscription || data.status === 'canceled')
  usePageSubtitle('A tua subscrição da plataforma.')

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader>
        {data && <Badge tone={reasonBadge(data.reason).tone}>{reasonBadge(data.reason).label}</Badge>}
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
                desc={
                  canSelfServeSubscribe
                    ? 'Adiciona um método de pagamento para a subscrição continuar automaticamente no fim do período.'
                    : 'No fim do período, a subscrição é cobrada automaticamente ao método de pagamento. Confirma que o teu cartão está registado.'
                }
                action={canSelfServeSubscribe ? subscribeAction : undefined}
              />
            )}
            {data.reason === 'incomplete' && (
              <Notice
                tone="amber"
                icon="alertTriangle"
                role="status"
                title="Subscrição por concluir."
                desc="Adiciona um método de pagamento para ativares a subscrição."
                action={portalAction}
              />
            )}
            {data.reason === 'grace' && (
              <Notice
                tone="amber"
                icon="alertTriangle"
                role="status"
                title={`Pagamento em atraso — regulariza até ${fmtDate(data.graceEndsAt)} para manteres o acesso.`}
                desc="Depois desta data, a gestão fica limitada a leitura até regularizares. Nenhum dado é apagado."
                action={portalAction}
              />
            )}
            {data.reason === 'past_due_locked' && (
              <Notice
                tone="red"
                icon="lock"
                role="alert"
                title="Acesso limitado a leitura — regulariza o pagamento."
                desc="Os teus dados estão seguros. Assim que o pagamento for regularizado, o acesso completo volta de imediato."
                action={portalAction}
              />
            )}
            {data.reason === 'canceled' && (
              <Notice
                tone="red"
                icon="ban"
                role="alert"
                title="Subscrição cancelada — acesso limitado a leitura."
                desc={
                  canSelfServeSubscribe
                    ? 'Reativa a subscrição com um novo cartão para recuperares o acesso completo. Nenhum dado é apagado.'
                    : 'Regulariza o pagamento para reativar a subscrição. Nenhum dado é apagado.'
                }
                action={
                  canSelfServeSubscribe
                    ? { ...subscribeAction, label: 'Reativar subscrição' }
                    : portalAction
                }
              />
            )}
            {data.reason === 'trial_expired' && (
              <Notice
                tone="red"
                icon="ban"
                role="alert"
                title="O teu período experimental terminou."
                desc="Adiciona um método de pagamento para continuares a usar a plataforma. Nenhum dado é apagado."
                action={subscribeAction}
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

            {/* Método de pagamento → Stripe Customer Portal. Só aparece quando já
                existe uma subscrição Stripe REAL por trás (`hasStripeSubscription`)
                — um trial local (self-serve, sem cartão ainda) nunca teve um
                cliente Stripe, e o CTA acima (Notice "Adicionar cartão", T9) já
                cobre a ação; mostrar este cartão só duplicaria o CTA e o clique
                resultaria sempre num 409 redundante. */}
            {data.hasStripeSubscription && (
              <Card className="p-5">
                <SectionTitle>Método de pagamento</SectionTitle>
                <p className="text-sm text-zinc-500">
                  Gere o cartão, descarrega faturas ou cancela no portal seguro do Stripe.
                </p>
                <Button
                  variant="outline"
                  icon="card"
                  className="mt-3"
                  disabled={portalM.isPending}
                  onClick={() => portalM.mutate()}
                >
                  {portalM.isPending ? 'A abrir…' : 'Gerir pagamento'}
                </Button>
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}
