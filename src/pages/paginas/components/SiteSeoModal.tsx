/**
 * «SEO do site» (F15): a pontuação de cada página com o primeiro problema, a média do site e o que o
 * site faz sozinho (CONTRATO §9). Clicar numa página abre as suas Definições e SEO.
 */
import { useMemo, useState } from "react";
import { Modal, SectionTitle } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { orderedLanguages } from "../fields/ctx";
import { SITE_DOES, siteSeo } from "../state/seo";
import { useBuilder } from "../state/store";
import { flattenPages, pagePathIn, pageTitle } from "../state/tree";
import { Seg } from "./EditorBits";
import { ScoreDot, useSeoEnv } from "./SeoBits";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Abre as Definições e SEO da página. */
  onOpenPage: (pageId: string) => void;
}

export function SiteSeoModal({ open, onClose, onOpenPage }: Props) {
  const { state, lang } = useBuilder();
  const env = useSeoEnv();
  const base = lang.defaultLanguage;
  const langs = orderedLanguages(lang);
  const [chosen, setChosen] = useState(base);
  const locale = langs.includes(chosen) ? chosen : base;
  const work = state.work;
  const { rows, average } = useMemo(
    () => (open ? siteSeo(work, locale, env, flattenPages(work.pages).map((r) => r.page)) : { rows: [], average: 0 }),
    [open, work, locale, env],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="SEO do site"
      subtitle={rows.length ? `Média do site: ${average}/100. Clica numa página para ver o que melhorar.` : undefined}
    >
      <div className="flex flex-col gap-5">
        {langs.length > 1 && <Seg label="Língua" value={locale} options={langs.map((l) => ({ id: l, label: l.toUpperCase() }))} onChange={setChosen} />}
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ page, report, first }) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => onOpenPage(page.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ScoreDot score={report.score} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{pageTitle(page, base)}</b>
                  <small className="block truncate font-mono text-xs text-zinc-500">
                    {pagePathIn(work.pages, page.id, locale, base)}
                    {page.status === "draft" ? " · rascunho" : ""}
                  </small>
                  <em className={`block text-xs not-italic ${first ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{first ? first.text : "Nada a melhorar."}</em>
                </span>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>
            </li>
          ))}
        </ul>
        <div>
          <SectionTitle>Feito automaticamente pelo site</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {SITE_DOES.map((t) => (
              <li key={t} className="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
