import { useMemo, useState } from 'react'
import { Card, PageHeader, EmptyState, Input, Button } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { usePageSubtitle } from '../context/PageMetaContext'
import { LineChart } from '../ui/charts.jsx'
import { KpiCard } from '../components/financeiro/kit'
import {
  useSiteAnalytics,
  useSetSiteDomain,
  type AnalyticsPeriod,
  type AnalyticsBreakdownRow,
  type AnalyticsTrackingSnippet,
} from '../hooks/useSiteAnalytics'

/**
 * Página "Estatísticas do site" (core, todos os tenants). Lê o tráfego do site
 * público do tenant via a nossa API (Umami auto-hospedado, server-side — o
 * Plausible saiu do projeto em 2026-09-21).
 * Estados: sem domínio (pede domínio) · com domínio mas sem site Umami ainda
 * (reason "no-analytics-site") · dashboard (KPIs + série de visitantes +
 * páginas + origens, com snippet copiável quando o tenant tem site externo).
 */

const PRESETS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'day', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Este mês' },
  { key: '6mo', label: '6 meses' },
]

const fmtInt = (n: number) => (n || 0).toLocaleString('pt-PT')

/** Segundos → "m s" legível (ex.: 2m 05s). */
function fmtDuration(seconds?: number): string {
  const s = Math.round(seconds ?? 0)
  if (!s) return '0s'
  const m = Math.floor(s / 60)
  const rest = s % 60
  return m > 0 ? `${m}m ${String(rest).padStart(2, '0')}s` : `${rest}s`
}

/** "2026-06-28" / "2026-06" → label curto para o eixo do gráfico. */
function shortLabel(date: string): string {
  if (!date) return ''
  const parts = date.split('-')
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}` // dia/mês
  if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}` // mês/ano
  return date
}

/** Lista "página/origem → visitantes" com barra proporcional. */
function BreakdownList({
  rows,
  labelKey,
  emptyLabel,
}: {
  rows: AnalyticsBreakdownRow[]
  labelKey: 'page' | 'source'
  emptyLabel: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.visitors || 0))
  if (rows.length === 0)
    return <p className="text-sm text-zinc-400 mt-3">{emptyLabel}</p>
  return (
    <ul className="mt-3 space-y-2.5">
      {rows.map((r, i) => {
        const label = (r[labelKey] as string) || (labelKey === 'source' ? 'Direto' : '/')
        return (
          <li key={`${label}-${i}`} className="relative">
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="truncate text-zinc-700 dark:text-zinc-200" title={label}>{label}</span>
              <span className="tabular-nums text-zinc-500 shrink-0">{fmtInt(r.visitors ?? 0)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(3, ((r.visitors || 0) / max) * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Formulário de configuração do domínio do site (estado reason:no-domain). */
function DomainForm({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const setDomain = useSetSiteDomain()
  return (
    <Card className="p-2">
      <EmptyState
        icon="globe"
        title="Define o domínio do teu site"
        desc="Indica o domínio do teu site público para começares a ver as estatísticas (ex.: exemplo.pt)."
        action={
          <form
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 w-full max-w-md"
            onSubmit={(e) => { e.preventDefault(); if (value.trim()) setDomain.mutate(value.trim()) }}
          >
            <div className="flex-1">
              <Input
                placeholder="exemplo.pt"
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" isLoading={setDomain.isPending} disabled={!value.trim()}>
              Guardar
            </Button>
          </form>
        }
      />
    </Card>
  )
}

/**
 * Snippet copiável do script de tracking — para sites EXTERNOS (fora do
 * site-engine, montados pelo dono: `tifas`, `winterplateau`,
 * `completepecasjr`). Um site do engine recebe o script automaticamente
 * (injetado pelo renderer); um externo tem de o colar à mão no próprio HTML.
 *
 * **Quem o vê é decisão da API, não desta página:** aparece exactamente quando
 * `GET /analytics/site` devolve `tracking`, e a API só o devolve quando o
 * domínio medido NÃO é servido pelo engine. Até 2026-09-22 vinha para toda a
 * gente e esta caixa aparecia a tenants do engine, a mandá-los colar um script
 * num HTML que não têm. Não reintroduzir aqui nenhuma condição própria — seria
 * duplicar regra de negócio no frontend, e os dois lados acabariam a discordar.
 */
function TrackingSnippetCard({ tracking }: { tracking: AnalyticsTrackingSnippet }) {
  const [copied, setCopied] = useState(false)
  // `src`/`websiteId` são opcionais no contrato (o objeto `tracking` só vem
  // inteiro ou não vem de todo). Sem esta guarda, um par incompleto passava no
  // `tsc` — interpolação aceita `undefined` — e dava ao tenant um snippet com
  // `data-website-id="undefined"` para colar no site. Melhor não mostrar caixa
  // nenhuma do que mandar colar um script partido.
  if (!tracking.src || !tracking.websiteId) return null
  const snippet = `<script defer src="${tracking.src}" data-website-id="${tracking.websiteId}"></script>`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <Icon name="link" className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Site fora da plataforma?
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            Se este site não é gerido por nós, cola este script no HTML do teu site para começares a receber estatísticas. Um site nosso já o tem automaticamente.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <Input
              readOnly
              value={snippet}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
              className="font-mono text-xs truncate cursor-text flex-1"
            />
            <Button
              type="button"
              variant={copied ? 'secondary' : 'primary'}
              onClick={copy}
              aria-label="Copiar script de estatísticas"
              icon={copied ? 'check' : 'copy'}
              className="shrink-0"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function Estatisticas() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const { data, isLoading } = useSiteAnalytics(period)
  // Mesmo texto nos 3 estados (configurado/no-domain/no-analytics-site) exceto
  // quando já há domínio guardado — chamado uma única vez, antes de qualquer
  // "return" condicional (regra dos hooks).
  usePageSubtitle(data?.domain ? `Tráfego de ${data.domain}.` : 'Tráfego do teu site público.')

  const agg = data?.aggregate
  const series = useMemo(() => {
    const ts = data?.timeseries ?? []
    return {
      labels: ts.map((p) => shortLabel(p.date ?? '')),
      series: [{ values: ts.map((p) => p.visitors ?? 0), label: 'Visitantes' }],
    }
  }, [data])

  // Estados de não-configuração (vêm com configured:false).
  if (!isLoading && data && data.configured === false) {
    if (data.reason === 'no-domain') {
      return (
        <div className="space-y-4">
          <DomainForm />
        </div>
      )
    }
    // no-analytics-site (ou outro): já há domínio, mas ainda não há um site
    // de estatísticas provisionado para ele.
    return (
      <div className="space-y-4">
        <Card className="p-2">
          <EmptyState
            icon="trend"
            title="Estatísticas ainda não disponíveis"
            desc="Ainda não há um site de estatísticas para este domínio. Se acabaste de o definir, tenta recarregar dentro de alguns minutos; se o problema persistir, fala com o suporte."
          />
        </Card>
      </div>
    )
  }

  const hasError = Boolean(data?.error)
  const hasData = (series.labels.length > 0)

  return (
    <div className="space-y-4">
      <PageHeader>
        <div className="inline-flex flex-wrap items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${period === p.key ? 'bg-accent text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {hasError && (
        <Card className="p-4 flex items-start gap-3 border-amber-200 dark:border-amber-900/50">
          <Icon name="info" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Não foi possível obter as estatísticas</p>
            <p className="text-zinc-500 mt-0.5">{data?.error}. Confirma que as estatísticas estão configuradas para este domínio.</p>
          </div>
        </Card>
      )}

      {data?.tracking && <TrackingSnippetCard tracking={data.tracking} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Visitantes" icon="users" tone="blue" loading={isLoading} value={fmtInt(agg?.visitors?.value ?? 0)} />
        <KpiCard label="Visualizações" icon="eye" tone="green" loading={isLoading} value={fmtInt(agg?.pageviews?.value ?? 0)} />
        <KpiCard label="Taxa de saída" icon="trend" tone="amber" loading={isLoading} value={`${Math.round(agg?.bounce_rate?.value ?? 0)}%`} />
        <KpiCard label="Duração média" icon="clock" tone="violet" loading={isLoading} value={fmtDuration(agg?.visit_duration?.value)} />
      </div>

      {/* Visitantes ao longo do tempo */}
      <Card className="p-5">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Visitantes ao longo do tempo</h2>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : hasData ? (
          <LineChart labels={series.labels} series={series.series} height={240} format={fmtInt} />
        ) : (
          <p className="text-sm text-zinc-400">Sem visitas registadas no período.</p>
        )}
      </Card>

      {/* Páginas + Origens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Páginas mais vistas</h2>
          <BreakdownList rows={data?.topPages ?? []} labelKey="page" emptyLabel="Sem páginas no período." />
        </Card>
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Origem do tráfego</h2>
          <BreakdownList rows={data?.sources ?? []} labelKey="source" emptyLabel="Sem origens no período." />
        </Card>
      </div>
    </div>
  )
}
