/**
 * Separador «Definições e SEO» de uma página (F15): nome, endereço (base + outras línguas), endereços
 * antigos (só leitura), estado, secção Google (pontuação, pré-visualização, verificações, título,
 * descrição, palavras-chave, imagem, avançado, aparecer no Google) e Apagar página.
 *
 * Tudo passa pelo `edit` do store com a chave de junção `page:<id>|<campo>` e actualiza enquanto se escreve:
 * as caixas têm chaves estáveis, nunca se re-montam (não se perde o foco). Os campos de texto/imagem são
 * os do construtor (`FieldRenderer`), por isso trazem "por traduzir", contadores e os issues do 422.
 */
import { useMemo, useState, type ReactNode } from "react";
import { quickToast } from "../state/notify";
import { Button, SectionTitle, Select } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { buildFieldCtx, orderedLanguages, revealFor } from "../fields/ctx";
import { FieldRenderer } from "../fields/FieldRenderer";
import { Issues, LangBadge } from "../fields/shared";
import type { FieldCtx } from "../fields/types";
import { setPageLocalSlug, setPageSlug, setPageStatus, setPageTitle, setSeoField, slugify } from "../state/pageSettings";
import { pageBlockers, type Blocker } from "../state/refs";
import { failingFirst } from "../state/seo";
import { useBuilder } from "../state/store";
import { pagePathIn, pageTitle, parentPathIn, pathChanges } from "../state/tree";
import type { FieldSpec, Issue, Page, Work } from "../state/types";
import { Confirm, Lbl, Seg, dangerBtn } from "./EditorBits";
import { CheckList, ScoreHead, Serp, useSeoReport } from "./SeoBits";

// ── definições dos campos (rótulos em português; limites do servidor, CONTRATO §2) ──

const TITLE_DEF: FieldSpec = { type: "text", i18n: true, max: 160, label: "Nome da página" };
const SEO_TITLE_DEF: FieldSpec = { type: "text", i18n: true, max: 120, label: "Título no Google" };
const SEO_DESC_DEF: FieldSpec = { type: "text", i18n: true, multiline: true, max: 320, label: "Descrição no Google" };
const SEO_KEYWORDS_DEF: FieldSpec = { type: "text", i18n: true, max: 300, label: "Palavras-chave" };
const SEO_IMAGE_DEF: FieldSpec = { type: "media", kind: "image", label: "Imagem ao partilhar" };

const boxLine =
  "flex min-h-10 min-w-0 items-stretch overflow-hidden rounded-lg border bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 dark:bg-zinc-900";

const Hint = ({ children }: { children: ReactNode }) => <p className="mt-1 text-xs text-zinc-400">{children}</p>;

interface SlugProps {
  lang: string;
  badge: string | null;
  prefix: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  label: string;
  issues: readonly Issue[];
  warn?: string | null;
  onChange: (text: string) => void;
  onBlur: (text: string) => void;
}

/** «/obras/ [ endereço ]»: o prefixo da mãe fixo e a caixa do endereço. */
function SlugRow({ lang, badge, prefix, value, placeholder, disabled, label, issues, warn, onChange, onBlur }: SlugProps) {
  const bad = issues.length > 0 || !!warn;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
      {badge ? <LangBadge lang={badge} /> : null}
      <div className="min-w-0 flex-1">
        <div className={`${boxLine} ${bad ? "border-red-400 dark:border-red-500/70" : "border-zinc-200 dark:border-zinc-700"}`}>
          <span title={prefix} className="max-w-[55%] shrink-0 truncate border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
            {prefix}
          </span>
          <input
            type="text"
            aria-label={label}
            aria-invalid={bad || undefined}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-100"
          />
        </div>
        {warn ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{warn}</p> : null}
        <Issues list={issues} className="mt-1" />
      </div>
    </div>
  );
}

// ── apagar: os motivos, clicáveis ─────────────────────────────────────────────

function BlockedList({ blockers, work, base, onGo }: { blockers: Blocker[]; work: Work; base: string; onGo: (b: Blocker) => void }) {
  const title = (id: string) => {
    const p = work.pages.find((x) => x.id === id);
    return p ? pageTitle(p, base) : "outra página";
  };
  const line = (b: Blocker): { text: string; go: string } => {
    switch (b.kind) {
      case "child": return { text: "Tem a subpágina", go: title(b.pageId) };
      case "block": return { text: "Tem uma ligação para ela no bloco", go: b.name };
      case "part": return { text: "Tem uma ligação para ela no", go: b.part === "topo" ? "Topo" : "Rodapé" };
      case "special": return { text: `Tem uma ligação para ela no especial «${b.name}» da página`, go: title(b.pageId) };
      case "canonical": return { text: "É a versão principal (canónica) da página", go: title(b.pageId) };
    }
  };
  return (
    <div role="note" className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <b className="flex items-center gap-1.5">
        <Icon name="lock" className="h-4 w-4" />
        Esta página não pode ser apagada enquanto:
      </b>
      <ul className="mt-1.5 flex flex-col">
        {blockers.map((b, i) => {
          const { text, go } = line(b);
          return (
            <li key={i} className="flex flex-wrap items-center gap-x-1.5">
              <span>{text}</span>
              <button
                type="button"
                onClick={() => onGo(b)}
                className="min-h-10 rounded-md px-1 font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {go}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── o separador ───────────────────────────────────────────────────────────────

const HANDLED = /^(title|slug|slugs|seo(\..*)?)$/;

export function PageSettings({ page }: { page: Page }) {
  const { state, lang, catalog, manifest, siteName, redirects, edit, apply, select } = useBuilder();
  const work = state.work;
  const base = lang.defaultLanguage;
  const langs = orderedLanguages(lang);
  const others = langs.filter((l) => l !== base);
  const [locale, setLocale] = useState(base);
  const [confirm, setConfirm] = useState(false);
  const report = useSeoReport(page.id, langs.includes(locale) ? locale : base);

  const put = (f: (w: Work) => Work, key?: string) => edit(f, key ? `page:${page.id}|${key}` : undefined);
  const seo = (typeof page.seo === "object" && page.seo !== null ? page.seo : {}) as Record<string, unknown>;

  // contexto dos campos: línguas, issues do 422 desta página e o "Ver onde" em curso
  const issues = useMemo(() => state.issues.filter((i) => i.entity === "page" && i.id === page.id), [state.issues, page.id]);
  const baseCtx = useMemo(() => buildFieldCtx({ work, lang, catalog, manifest, issues }), [work, lang, catalog, manifest, issues]);
  const focus = revealFor(state.focus, state.reveal, "page", page.id);
  const ctxFor = (name: string, path: string): FieldCtx => ({ ...baseCtx, focus, name, path });

  const slugIssues = (l: string) => issues.filter((i) => (i.path === "slug" || i.path === "slugs") && (i.locale ?? base) === l);
  const stray = issues.filter((i) => !HANDLED.test(i.path ?? ""));

  // endereços
  const dup = (l: string): string | null => {
    const mine = pagePathIn(work.pages, page.id, l, base);
    return work.pages.some((q) => q.id !== page.id && pagePathIn(work.pages, q.id, l, base) === mine) ? "Já existe outra página com este endereço." : null;
  };
  const parent = work.pages.find((p) => p.id === page.parentId);
  const old = redirects.filter((r) => r.pageId === page.id);
  const changes = pathChanges(state.server.pages, work.pages, page.id, langs, base);
  const moved = changes.own.length > 0 || changes.others > 0;

  // apagar
  const blockers = useMemo(() => pageBlockers(work, catalog, manifest, page.id), [work, catalog, manifest, page.id]);
  const goBlocker = (b: Blocker) => {
    switch (b.kind) {
      case "child": return select({ pageId: b.pageId, libId: null, sel: { kind: "page", id: b.pageId } });
      case "block": return select({ libId: b.blockId, sel: { kind: "block", id: b.blockId } });
      case "part": return select({ libId: null, sel: { kind: "part", id: b.part } });
      case "special": return select({ pageId: b.pageId, libId: null, sel: { kind: "item", id: b.itemId } });
      case "canonical": return select({ pageId: b.pageId, libId: null, sel: { kind: "page", id: b.pageId }, tab: "settings" });
    }
  };
  const remove = () => {
    apply({ type: "deletePage", id: page.id });
    quickToast(`«${pageTitle(page, base)}» apagada. Os blocos continuam em Blocos.`);
  };

  const field = (def: FieldSpec, name: string, path: string, value: unknown, onChange: (v: unknown, key?: string) => void) => (
    <FieldRenderer key={path} def={def} value={value} onChange={onChange} ctx={ctxFor(name, path)} />
  );
  const seoField = (def: FieldSpec, name: string) => field(def, name, `seo.${name}`, seo[name], (v, key) => put((w) => setSeoField(w, page.id, name, v), key));

  return (
    <div className="flex flex-col gap-5 pb-20">
      {stray.length > 0 && <Issues list={stray} />}

      {field(TITLE_DEF, "title", "title", page.title, (v, key) => put((w) => setPageTitle(w, page.id, v as Page["title"]), key))}

      <div>
        <Lbl hint={langs.length > 1 ? base.toUpperCase() : undefined}>Endereço</Lbl>
        <SlugRow
          lang={base}
          badge={null}
          prefix={`${parentPathIn(work.pages, page.id, base, base)}/`}
          value={page.slug}
          disabled={page.isHome}
          label="Endereço"
          issues={slugIssues(base)}
          warn={page.isHome ? null : dup(base)}
          onChange={(t) => put((w) => setPageSlug(w, page.id, slugify(t, false)), "slug")}
          onBlur={(t) => put((w) => setPageSlug(w, page.id, slugify(t, true)))}
        />
        <Hint>
          {page.isHome
            ? "A página inicial fica sempre em /."
            : parent
              ? `Está dentro de «${pageTitle(parent, base)}». Para a mudar de sítio, arrasta-a na lista de Páginas.`
              : "Para a pôr dentro de outra página, arrasta-a para cima dela na lista de Páginas."}
        </Hint>
      </div>

      {!page.isHome && others.length > 0 && (
        <div>
          <Lbl hint="Se ficar vazio, usa o da base">Endereço noutras línguas</Lbl>
          <div className="flex flex-col gap-2">
            {others.map((l) => (
              <SlugRow
                key={l}
                lang={l}
                badge={l}
                prefix={`/${l}${parentPathIn(work.pages, page.id, l, base)}/`}
                value={page.slugs?.[l] ?? ""}
                placeholder={page.slug}
                label={`Endereço em ${l.toUpperCase()}`}
                issues={slugIssues(l)}
                warn={page.slugs?.[l] || !dup(base) ? dup(l) : null}
                onChange={(t) => put((w) => setPageLocalSlug(w, page.id, l, slugify(t, false)), `slug:${l}`)}
                onBlur={(t) => put((w) => setPageLocalSlug(w, page.id, l, slugify(t, true)))}
              />
            ))}
          </div>
        </div>
      )}

      {moved && (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <Icon name="link" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O endereço antigo vai continuar a funcionar: ao guardar, quem o tiver guardado (e o Google) é levado para o novo.
            {changes.own.map((c) => (
              <span key={c.from} className="block font-mono text-[13px]">{c.from} → {c.to}</span>
            ))}
            {changes.others > 0 && <span className="block">O mesmo acontece a {changes.others} {changes.others === 1 ? "subpágina" : "subpáginas"}.</span>}
          </span>
        </div>
      )}

      {old.length > 0 && (
        <div>
          <Lbl hint="Redireccionam para aqui">Endereços antigos</Lbl>
          <ul className="flex flex-col gap-1.5">
            {old.map((r) => (
              <li key={r.fromPath} className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700">
                <code className="break-all font-mono text-[13px] text-zinc-700 dark:text-zinc-200">{r.fromPath}</code>
                <span className="text-xs text-zinc-400">→ esta página</span>
              </li>
            ))}
          </ul>
          <Hint>Quando muda o endereço ou a página de sítio, o antigo continua a funcionar. Deixa de redireccionar sozinho se voltar a ser o endereço de uma página.</Hint>
        </div>
      )}

      <div>
        <Lbl>Estado</Lbl>
        <Seg
          label="Estado"
          value={page.status === "published" ? "published" : "draft"}
          options={[{ id: "draft", label: "Rascunho" }, { id: "published", label: "Publicada" }]}
          onChange={(id) => put((w) => setPageStatus(w, page.id, id as Page["status"]))}
        />
        <Hint>Uma página em rascunho não aparece no site.</Hint>
      </div>

      <section aria-label="Google (SEO)" className="flex flex-col gap-4">
        <SectionTitle className="!mb-0">Google (SEO)</SectionTitle>
        {langs.length > 1 && <Seg label="Língua da pré-visualização" value={langs.includes(locale) ? locale : base} options={langs.map((l) => ({ id: l, label: l.toUpperCase() }))} onChange={setLocale} />}
        {report && (
          <>
            <Serp report={report} siteName={siteName} />
            <ScoreHead report={report} />
            <CheckList checks={failingFirst(report.checks)} />
          </>
        )}
        <div>
          {seoField(SEO_KEYWORDS_DEF, "keywords")}
          <Hint>O que as pessoas escrevem no Google para chegar a esta página. Separa por vírgulas; a primeira é a principal. O Google não lê esta lista: conta é a palavra aparecer no título, no H1, na descrição e no endereço.</Hint>
        </div>
        <div>
          {seoField(SEO_TITLE_DEF, "title")}
          <Hint>Se ficar vazio, usa o nome da página. O nome do site é acrescentado no fim.</Hint>
        </div>
        <div>
          {seoField(SEO_DESC_DEF, "description")}
          <Hint>O texto por baixo do título nos resultados. Até 160 caracteres.</Hint>
        </div>
        <div>
          {seoField(SEO_IMAGE_DEF, "image")}
          <Hint>Aparece no WhatsApp, Facebook e LinkedIn. Sem imagem, usa a primeira da página.</Hint>
        </div>
        <details className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium text-zinc-600 dark:text-zinc-300">Avançado</summary>
          <div className="pb-2 pt-1">
            <Select
              label="Versão principal (canónica)"
              className="min-h-10"
              value={typeof seo.canonicalPageId === "string" ? seo.canonicalPageId : ""}
              onChange={(e: { target: { value: string } }) => put((w) => setSeoField(w, page.id, "canonicalPageId", e.target.value || undefined))}
            >
              <option value="">Esta própria página (recomendado)</option>
              {work.pages.filter((q) => q.id !== page.id).map((q) => (
                <option key={q.id} value={q.id}>{pageTitle(q, base)} · {pagePathIn(work.pages, q.id, base, base)}</option>
              ))}
            </Select>
            <Hint>Só se esta página repetir o conteúdo de outra: diz ao Google qual das duas deve aparecer.</Hint>
          </div>
        </details>
        <div>
          <Lbl>Aparecer no Google</Lbl>
          <Seg
            label="Aparecer no Google"
            value={seo.noindex === true ? "no" : "yes"}
            options={[{ id: "yes", label: "Sim" }, { id: "no", label: "Não" }]}
            onChange={(id) => put((w) => setSeoField(w, page.id, "noindex", id === "no" ? true : undefined))}
          />
          <Hint>«Não» esconde a página dos motores de busca, mas continua no site.</Hint>
        </div>
      </section>

      <section aria-label="Apagar página" className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {page.isHome ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">A página inicial não pode ser apagada.</p>
        ) : (
          blockers.length > 0 && <BlockedList blockers={blockers} work={work} base={base} onGo={goBlocker} />
        )}
        {!page.isHome && (
          <div className="flex flex-wrap items-center gap-2">
            {confirm && blockers.length === 0 ? (
              <Confirm text={`Apagar «${pageTitle(page, base)}»? Os blocos continuam em Blocos.`} action="Apagar" onYes={remove} onNo={() => setConfirm(false)} />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className={`min-h-10 ${dangerBtn}`}
                icon={blockers.length ? "lock" : "trash"}
                disabled={blockers.length > 0}
                title={blockers.length ? "Resolve primeiro os motivos acima" : undefined}
                onClick={() => setConfirm(true)}
              >
                Apagar página
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
