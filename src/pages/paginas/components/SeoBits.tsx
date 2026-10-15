/**
 * Peças de SEO partilhadas (F15): o selo «SEO NN» (no cartão da página e no caminho dos editores), a
 * pontuação, a lista de verificações e a pré-visualização do resultado no Google. A pontuação sai de
 * `state/seo.ts` e recalcula-se a cada alteração (o trabalho é a fonte).
 */
import { useMemo } from "react";
import { Icon } from "../../../ui/icons.jsx";
import { seoBand, seoReport, type SeoCheck, type SeoEnv, type SeoReport, TITLE_MAX, DESC_MAX } from "../state/seo";
import { useBuilder } from "../state/store";

const TONE = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  mid: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
} as const;

export function useSeoEnv(): SeoEnv {
  const { catalog, lang, siteName } = useBuilder();
  return useMemo(() => ({ catalog, lang, siteName }), [catalog, lang, siteName]);
}

/** O relatório de SEO de uma página, numa língua (a base por omissão). Recalcula com o trabalho. */
export function useSeoReport(pageId: string | null, locale?: string): SeoReport | null {
  const { state, lang } = useBuilder();
  const env = useSeoEnv();
  const work = state.work;
  const l = locale ?? lang.defaultLanguage;
  return useMemo(() => {
    const page = work.pages.find((p) => p.id === pageId);
    return page ? seoReport(work, page, l, env) : null;
  }, [work, pageId, l, env]);
}

/** «SEO 72»: abre as Definições e SEO da página. */
export function SeoSeal({ pageId, onClick }: { pageId: string; onClick: () => void }) {
  const report = useSeoReport(pageId);
  if (!report) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Pontuação de SEO: abrir as definições e o SEO desta página"
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${TONE[seoBand(report.score)]}`}
    >
      <Icon name={report.score >= 80 ? "check" : "alertCircle"} className="h-3.5 w-3.5" />
      SEO {report.score}
    </button>
  );
}

/** A pontuação pequena (lista do «SEO do site»). */
export function ScoreDot({ score }: { score: number }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border px-1 text-[13px] font-bold ${TONE[seoBand(score)]}`}>
      {score}
    </span>
  );
}

/** A pontuação grande e o resumo («3 a melhorar · 8 certos»). */
export function ScoreHead({ report }: { report: SeoReport }) {
  const bad = report.checks.filter((c) => !c.ok).length;
  return (
    <div className="flex items-baseline gap-2" role="status" aria-label={`Pontuação de SEO ${report.score} de 100`}>
      <b className={`text-3xl font-bold ${report.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : report.score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{report.score}</b>
      <span className="text-sm text-zinc-400">/100</span>
      <small className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
        {bad ? `${bad} a melhorar · ` : "Sem nada a melhorar · "}
        {report.checks.length - bad} certos
      </small>
    </div>
  );
}

/** As verificações, as que falham primeiro. */
export function CheckList({ checks }: { checks: readonly SeoCheck[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((c) => (
        <li key={c.id} className={`flex items-start gap-2 text-[13px] ${c.ok ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-800 dark:text-zinc-100"}`}>
          <Icon name={c.ok ? "check" : "alertCircle"} className={`mt-0.5 h-4 w-4 shrink-0 ${c.ok ? "text-emerald-500" : "text-amber-500"}`} />
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Como a página aparece nos resultados do Google: título com « · site», endereço em migalhas, descrição e contadores. */
export function Serp({ report, siteName }: { report: SeoReport; siteName: string }) {
  const crumbs = report.path.split("/").filter(Boolean);
  const name = siteName || "O teu site";
  const t = report.googleTitle;
  const d = report.description;
  return (
    <div>
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950" data-testid="serp">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 text-xs leading-tight text-zinc-600 dark:text-zinc-300">
            <b className="block truncate font-medium text-zinc-800 dark:text-zinc-100">{name}</b>
            <span className="block truncate">{crumbs.join(" › ") || "Início"}</span>
          </span>
        </div>
        <div className="mt-1.5 text-lg leading-snug text-blue-700 dark:text-blue-300">{cut(t, TITLE_MAX) || "Sem título"}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">{d ? cut(d, DESC_MAX) : "Sem descrição: o Google escolhe um excerto da página."}</div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className={t.length > TITLE_MAX ? "font-semibold text-red-600 dark:text-red-400" : ""}>Título {t.length}/{TITLE_MAX}</span>
        <span className={d.length > DESC_MAX ? "font-semibold text-red-600 dark:text-red-400" : ""}>Descrição {d.length}/{DESC_MAX}</span>
        <span>Pré-visualização em {report.locale.toUpperCase()}</span>
      </div>
    </div>
  );
}
