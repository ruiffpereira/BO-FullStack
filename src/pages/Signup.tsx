import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icon } from '../ui/icons.jsx'
import { Button, Input, Badge } from '../ui/ui.jsx'
import { usePostUsersSignup } from '../gen/backoffice/hooks/usePostUsersSignup'
import { usePostUsersSignupResend } from '../gen/backoffice/hooks/usePostUsersSignupResend'
import { useGetBillingCatalog } from '../gen/backoffice/hooks/useGetBillingCatalog'
import { getApiError } from '../lib/apiError'
import { MODULE_LABELS, BILLABLE_MODULES, eur, type BillableModule } from '../lib/billingStatus'
import { VERTICALS, VERTICAL_MODULES, isVertical, type Vertical } from '../lib/verticals'

/**
 * `/signup` — signup self-serve público (T8, brief `.design/self-serve/`). Par
 * standalone do `Login.tsx` (sem Shell). 2 passos + 1 estado final:
 *  1. Negócio: vertical (radio cards) + nome do negócio + email.
 *  2. Plano: módulos pré-marcados pela vertical (editável) + total €/mês live,
 *     lido do catálogo PÚBLICO (`GET /billing/catalog`, sem auth).
 *  3. "Confirma o teu email" — SEMPRE o mesmo ecrã de sucesso (anti-enumeração:
 *     a API responde sempre `{ ok: true }`, exista ou não o email).
 *
 * Foco gerido entre passos: o heading de cada passo recebe foco (screen readers
 * anunciam a mudança). Query `?vertical=` pré-seleciona (ignorada se inválida).
 */

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

type Step = 'business' | 'plan' | 'sent'

const RESEND_COOLDOWN_S = 60

function readInitialVertical(): Vertical | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('vertical')
  return isVertical(v) ? v : null
}

export function Signup({ theme, onToggleTheme }: Props) {
  const [step, setStep] = useState<Step>('business')
  const [vertical, setVertical] = useState<Vertical | null>(readInitialVertical)
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [modules, setModules] = useState<BillableModule[]>(() => {
    const v = readInitialVertical()
    return v ? VERTICAL_MODULES[v] : []
  })
  const [errors, setErrors] = useState<{ vertical?: string; businessName?: string; email?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const headingRef = useRef<HTMLHeadingElement>(null)

  // Foco gerido entre passos — o heading do passo recebe foco (anúncio para
  // leitores de ecrã sem depender só do role=status do ecrã final).
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  // Cooldown do reenvio (1 tick/seg, um único `setInterval` por "sessão" de
  // cooldown — não um `setTimeout` re-armado a cada tick via effect, que exigiria
  // um novo commit/efeito entre cada tick). `cooldownEpoch` marca o início de
  // cada sessão: a 1.ª ao chegar ao ecrã "sent", outra a cada reenvio bem-sucedido.
  const [cooldownEpoch, setCooldownEpoch] = useState(0)
  const armCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S)
    setCooldownEpoch((e) => e + 1)
  }
  useEffect(() => {
    if (step === 'sent') armCooldown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  useEffect(() => {
    if (cooldownEpoch === 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldownEpoch])

  const { data: catalog = [], isLoading: catalogLoading, isError: catalogError } = useGetBillingCatalog()
  // Catálogo PÚBLICO — só devolve módulos ATIVOS (ver useGetBillingCatalog). Um
  // módulo ausente daqui está "indisponível" (não é rejeitado por estar inativo,
  // simplesmente não aparece) — usado para desativar/etiquetar no passo 2.
  const catalogByModule = useMemo(
    () => Object.fromEntries(catalog.map((c) => [c.module, c])) as Record<string, (typeof catalog)[number]>,
    [catalog],
  )
  const catalogReady = !catalogLoading && !catalogError
  const total = useMemo(
    () => modules.reduce((sum, m) => sum + (catalogByModule[m]?.monthlyAmountEur ?? 0), 0),
    [modules, catalogByModule],
  )

  // Poda módulos indisponíveis assim que o catálogo responde — cobre o caso de a
  // vertical vir pré-selecionada da query string antes do catálogo carregar.
  useEffect(() => {
    if (!catalogReady) return
    setModules((cur) => cur.filter((m) => !!catalogByModule[m]))
  }, [catalogReady, catalogByModule])

  const signupM = usePostUsersSignup({
    mutation: {
      onSuccess: () => {
        setSubmitError(null)
        setStep('sent')
      },
      onError: (error) => setSubmitError(getApiError(error, 'Não foi possível criar a conta. Tenta novamente.')),
    },
  })

  const resendM = usePostUsersSignupResend({
    mutation: {
      onSuccess: () => armCooldown(),
      onError: (error) => toast.error(getApiError(error, 'Não foi possível reenviar o email.')),
    },
  })

  const selectVertical = (v: Vertical) => {
    setVertical(v)
    const preset = VERTICAL_MODULES[v]
    // Não pré-seleciona um módulo indisponível no catálogo público (ativo) — a
    // API rejeitaria (400) e a UI mostrá-lo-ia "Indisponível" já desmarcado.
    setModules(catalogReady ? preset.filter((m) => !!catalogByModule[m]) : preset)
    setErrors((e) => ({ ...e, vertical: undefined }))
  }

  const toggleModule = (m: BillableModule) =>
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const goToPlan = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!vertical) errs.vertical = 'Escolhe o tipo de negócio.'
    if (businessName.trim().length < 2) errs.businessName = 'Nome do negócio demasiado curto.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Introduz um email válido.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setStep('plan')
  }

  const submit = () => {
    if (!vertical) return
    signupM.mutate({
      data: { businessName: businessName.trim(), email: email.trim(), vertical, modules },
    })
  }

  return (
    <div
      className={`min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}
    >
      <div className="absolute top-4 right-4">
        <button
          onClick={onToggleTheme}
          aria-label="Tema"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <img src="/icons/logo.svg?v=6" alt="" className="w-9 h-9 shrink-0" />
          <span className="font-semibold text-[17px] tracking-tight text-zinc-900 dark:text-white">Backoffice</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
          {step === 'sent' ? (
            <div role="status" className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Icon name="mail" className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-zinc-900 dark:text-white outline-none">
                Confirma o teu email
              </h1>
              <p className="text-sm text-zinc-500">
                Enviámos um link para <strong className="text-zinc-700 dark:text-zinc-200">{email}</strong>. Abre-o
                para definires a tua password e começares a usar a plataforma.
              </p>
              <Button
                variant="outline"
                className="w-full mt-2"
                disabled={cooldown > 0 || resendM.isPending}
                onClick={() => resendM.mutate({ data: { email: email.trim() } })}
              >
                {resendM.isPending ? 'A reenviar…' : cooldown > 0 ? `Reenviar email (${cooldown}s)` : 'Reenviar email'}
              </Button>
              <Link to="/login" className="block text-sm text-accent font-medium hover:underline mt-1">
                Voltar ao login
              </Link>
            </div>
          ) : step === 'business' ? (
            <form onSubmit={goToPlan} noValidate>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight outline-none"
              >
                A tua app de gestão
              </h1>
              <p className="text-sm text-zinc-500 mt-1 mb-5">14 dias grátis, sem cartão.</p>

              <fieldset className="mb-4">
                <legend className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Tipo de negócio
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Tipo de negócio"
                  aria-describedby={errors.vertical ? 'vertical-error' : undefined}
                  className="grid grid-cols-2 gap-2"
                >
                  {VERTICALS.map((v) => {
                    const checked = vertical === v.id
                    return (
                      <label
                        key={v.id}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 cursor-pointer text-center transition-colors focus-within:ring-2 focus-within:ring-accent/40 ${
                          checked
                            ? 'border-accent bg-accent/5 dark:bg-accent/10'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="vertical"
                          value={v.id}
                          checked={checked}
                          onChange={() => selectVertical(v.id)}
                          className="sr-only"
                        />
                        <Icon name={v.icon} className={`w-5 h-5 ${checked ? 'text-accent' : 'text-zinc-400'}`} />
                        <span
                          className={`text-[13px] font-medium ${checked ? 'text-accent' : 'text-zinc-700 dark:text-zinc-200'}`}
                        >
                          {v.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {errors.vertical && (
                  <p id="vertical-error" className="text-[13px] text-red-500 mt-1.5">
                    {errors.vertical}
                  </p>
                )}
              </fieldset>

              <div className="space-y-4">
                <div>
                  <Input
                    label="Nome do negócio"
                    icon="store"
                    placeholder="Barbearia do Zé"
                    value={businessName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setBusinessName(e.target.value)
                      setErrors((er) => ({ ...er, businessName: undefined }))
                    }}
                    aria-describedby={errors.businessName ? 'business-name-error' : undefined}
                  />
                  {errors.businessName && (
                    <p id="business-name-error" className="text-[13px] text-red-500 mt-1">
                      {errors.businessName}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    label="Email"
                    icon="mail"
                    type="email"
                    placeholder="tu@negocio.pt"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setEmail(e.target.value)
                      setErrors((er) => ({ ...er, email: undefined }))
                    }}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-[13px] text-red-500 mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full mt-5">
                Continuar
              </Button>
              <p className="text-center text-sm text-zinc-500 mt-4">
                Já tens conta?{' '}
                <Link to="/login" className="text-accent font-medium hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight outline-none"
                >
                  Escolhe o teu plano
                </h1>
                <Badge tone="green">14 dias grátis, sem cartão</Badge>
              </div>
              <p className="text-sm text-zinc-500 mb-5">
                Pré-selecionámos os módulos para {VERTICALS.find((v) => v.id === vertical)?.label ?? 'o teu negócio'} —
                ajusta como quiseres.
              </p>

              <div className="space-y-2">
                {BILLABLE_MODULES.map((m) => {
                  const entry = catalogByModule[m]
                  // Indisponível = fora do catálogo público (só módulos ATIVOS) depois
                  // de carregado — mesmo padrão do CreateSubscriptionModal em
                  // AdminBilling (`inactive = entry ? !entry.active : false`), adaptado
                  // ao catálogo público (que já vem filtrado para só módulos ativos).
                  const inactive = catalogReady && !entry
                  const checked = modules.includes(m) && !inactive
                  return (
                    // Preço/badge FORA do <label> — o nome acessível do checkbox fica só
                    // o módulo (mesmo padrão do CreateSubscriptionModal em AdminBilling).
                    <div
                      key={m}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-colors ${
                        inactive
                          ? 'border-zinc-200 dark:border-zinc-700 opacity-60'
                          : checked
                            ? 'border-accent bg-accent/5 dark:bg-accent/10'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <label
                        className={`flex items-center gap-3 flex-1 ${inactive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={inactive}
                          onChange={() => toggleModule(m)}
                          className="rounded border-zinc-300 text-accent focus:ring-accent/20"
                        />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {MODULE_LABELS[m] ?? m}
                        </span>
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        {inactive && <Badge tone="neutral">Indisponível</Badge>}
                        <span className="text-sm text-zinc-500 tabular-nums">
                          {entry ? `${eur.format(entry.monthlyAmountEur)}/mês` : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {submitError && (
                <p className="text-[13px] text-red-500 flex items-center gap-1.5 mt-4">
                  <Icon name="ban" className="w-4 h-4 shrink-0" />
                  {submitError}
                </p>
              )}

              <div className="sticky bottom-0 sm:static mt-5 -mx-6 sm:mx-0 px-6 sm:px-0 pt-4 pb-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur sm:backdrop-blur-none border-t border-zinc-100 dark:border-zinc-800 sm:border-0">
                <div className="mb-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-zinc-500">Total</span>
                    {catalogLoading ? (
                      <span className="h-5 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                    ) : (
                      <span className="text-lg font-semibold text-zinc-900 dark:text-white tabular-nums">
                        {catalogError ? '—' : eur.format(total)}
                        <span className="text-sm font-normal text-zinc-400"> /mês</span>
                      </span>
                    )}
                  </div>
                  {catalogLoading && <p className="text-xs text-zinc-400 mt-1">A carregar preços…</p>}
                  {catalogError && (
                    <p className="text-[13px] text-red-500 mt-1 flex items-center gap-1.5">
                      <Icon name="ban" className="w-3.5 h-3.5 shrink-0" />
                      Não foi possível carregar os preços. Recarrega a página.
                    </p>
                  )}
                </div>
                <Button size="lg" className="w-full" disabled={signupM.isPending || catalogError} onClick={submit}>
                  {signupM.isPending ? 'A criar conta…' : 'Criar conta'}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('business')}
                  className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mt-3"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
