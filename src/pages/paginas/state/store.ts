/**
 * Estado do construtor de páginas: `useReducer` + contexto (sem libs).
 *
 *  - `server`  — o último estado conhecido da API (o que o `save` tem de transformar em `work`)
 *  - `work`    — a cópia de trabalho que a cliente edita
 *  - `history` — fotografias JSON do `work` (desfazer/refazer, máx. 200)
 *  - selecção  — `pageId`, `libId`, `sel` (o desenho vem nas fatias seguintes)
 *  - `status`  — ciclo de gravação; 409 → "conflict" (o trabalho fica até a cliente escolher),
 *    422 → `issues` guardados para as fatias seguintes os mostrarem nos sítios certos
 *
 * Toda a regra está em `state/*`: o componente só chama `edit`, `undo`, `redo`, `save`…
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GetCmsSiteBuilder200 } from "../../../gen/backoffice/types/GetCmsSiteBuilder";
import { publishErrorMessage, readApiFailure, siteBuilderQueryKey, usePublishSiteBuilder, useSaveSiteBuilder } from "../../../hooks/useSiteBuilder";
import { buildChangeset, fromServer } from "./changeset";
import { canRedo, canUndo, createHistory, markSaved, record, redo, snapshot, undo, type History } from "./history";
import { applyOp, type WorkOp } from "./ops";
import { PendingUploadError, hasPending, replaceUrls, uploadPending } from "./pending";
import { countMissing, findMissing, firstMissing, locateMissing, type MissingItem } from "./missing";
import type { Catalog, Issue, LangCtx, Manifest, SaveBody, Sel, Work } from "./types";

export type PageTab = "content" | "settings";
export type SaveStatus = "idle" | "saving" | "conflict" | "invalid" | "error";

export interface Failure {
  status: number | null;
  code?: string;
  message: string;
  /** Corpo do erro (ex.: `refs` de PAGE_IN_USE, `pages` de BLOCK_IN_USE). */
  data: Record<string, unknown>;
}

export interface StoreState {
  revision: number;
  server: Work;
  work: Work;
  history: History;
  pageId: string | null;
  libId: string | null;
  sel: Sel;
  /** Separador da página aberta (Conteúdo | Definições e SEO). Outra página ou um editor → volta a "content". */
  tab: PageTab;
  /** Último campo "por traduzir" para onde o "Ver onde" levou (abre o sítio e foca a caixa). */
  focus: MissingItem | null;
  /** Sobe a cada "Ver onde" (o mesmo campo outra vez volta a focar); `null` assim que se navega para outro sítio. */
  reveal: number | null;
  status: SaveStatus;
  issues: Issue[];
  /** Revisão que o servidor tem agora (409). */
  conflictRevision: number | null;
  failure: Failure | null;
}

export type Action =
  | { type: "load"; work: Work; revision: number }
  | { type: "edit"; update: (w: Work) => Work; key?: string; now?: number }
  | { type: "op"; op: WorkOp; now?: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; pageId?: string | null; libId?: string | null; sel?: Sel; focus?: MissingItem | null; tab?: PageTab }
  /** Ficheiros pendentes já enviados: troca os marcadores `blob:` pelos URLs reais (sem entrada nova no desfazer). */
  | { type: "mediaUploaded"; map: Record<string, string> }
  | { type: "saveStart" }
  | { type: "saveOk"; revision: number; sent: Work }
  | { type: "conflict"; revision: number | null }
  | { type: "invalid"; issues: Issue[] }
  | { type: "failed"; failure: Failure }
  | { type: "dismiss" };

const asRedirects = (v: unknown): { fromPath: string; pageId: string }[] =>
  (Array.isArray(v) ? v : []).filter(
    (r): r is { fromPath: string; pageId: string } => typeof r?.fromPath === "string" && typeof r?.pageId === "string",
  );

const homeOrFirst = (w: Work): string | null => (w.pages.find((p) => p.isHome) ?? w.pages[0])?.id ?? null;

const clone = (w: Work): Work => JSON.parse(snapshot(w)) as Work;

export function initState(work: Work, revision: number): StoreState {
  return {
    revision,
    server: clone(work),
    work,
    history: createHistory(work),
    pageId: homeOrFirst(work),
    libId: null,
    sel: null,
    tab: "content",
    focus: null,
    reveal: null,
    status: "idle",
    issues: [],
    conflictRevision: null,
    failure: null,
  };
}

/** Depois de editar/desfazer: nada selecionado pode apontar para algo que já não existe. */
function fixSelection(s: StoreState, work: Work): Pick<StoreState, "pageId" | "libId" | "sel"> {
  const pageOk = s.pageId !== null && work.pages.some((p) => p.id === s.pageId);
  const libOk = s.libId !== null && work.blocks.some((b) => b.id === s.libId);
  let sel = s.sel;
  if (sel && sel.kind !== "part") {
    const id = sel.id;
    const alive =
      sel.kind === "page" ? work.pages.some((p) => p.id === id)
      : sel.kind === "block" ? work.blocks.some((b) => b.id === id)
      : Object.values(work.items).some((l) => l.some((it) => it.id === id));
    if (!alive) sel = null;
  }
  return { pageId: pageOk ? s.pageId : homeOrFirst(work), libId: libOk ? s.libId : null, sel };
}

export function reduce(s: StoreState, a: Action): StoreState {
  switch (a.type) {
    case "load":
      return initState(a.work, a.revision);
    case "edit": {
      const next = a.update(s.work);
      if (next === s.work) return s;
      return { ...s, work: next, history: record(s.history, next, a.key, a.now), ...fixSelection(s, next) };
    }
    case "op": {
      // Operações da lista lateral (mover, criar, renomear…): uma entrada no desfazer cada.
      const r = reduce(s, { type: "edit", update: (w) => applyOp(w, a.op), now: a.now });
      if (r === s || a.op.type !== "addPage") return r;
      return { ...r, pageId: a.op.page.id, libId: null, sel: { kind: "page", id: a.op.page.id } };
    }
    case "undo": {
      const r = undo(s.history);
      return r ? { ...s, work: r.work, history: r.history, ...fixSelection(s, r.work) } : s;
    }
    case "redo": {
      const r = redo(s.history);
      return r ? { ...s, work: r.work, history: r.history, ...fixSelection(s, r.work) } : s;
    }
    case "select": {
      // Outra página, ou um editor de bloco/parte/especial, volta ao separador "Conteúdo".
      const leaves = (a.pageId !== undefined && a.pageId !== s.pageId) || (a.sel !== undefined && a.sel?.kind !== "page");
      return {
        ...s,
        pageId: a.pageId === undefined ? s.pageId : a.pageId,
        libId: a.libId === undefined ? s.libId : a.libId,
        sel: a.sel === undefined ? s.sel : a.sel,
        tab: a.tab ?? (leaves ? "content" : s.tab),
        focus: a.focus === undefined ? s.focus : a.focus,
        reveal: a.focus ? (s.reveal ?? 0) + 1 : null,
      };
    }
    case "mediaUploaded": {
      const work = replaceUrls(s.work, a.map);
      if (work === s.work) return s;
      const stack = s.history.stack.slice();
      stack[s.history.i] = snapshot(work);
      return { ...s, work, history: { ...s.history, stack, lastKey: null, lastAt: 0 } };
    }
    case "saveStart":
      return { ...s, status: "saving", issues: [], failure: null, conflictRevision: null };
    case "saveOk":
      return {
        ...s,
        revision: a.revision,
        server: clone(a.sent),
        history: markSaved(s.history, a.sent),
        status: "idle",
        issues: [],
        failure: null,
        conflictRevision: null,
      };
    case "conflict":
      return { ...s, status: "conflict", conflictRevision: a.revision };
    case "invalid":
      return { ...s, status: "invalid", issues: a.issues };
    case "failed":
      return { ...s, status: "error", failure: a.failure };
    case "dismiss":
      return s.status === "saving" ? s : { ...s, status: "idle", conflictRevision: null, failure: null };
  }
}

// ── contexto ──────────────────────────────────────────────────────────────────

export interface Builder {
  state: StoreState;
  /** Há alterações por gravar (o changeset não está vazio). */
  dirty: boolean;
  /** O que o próximo `save` mandaria (`null` = nada). */
  changeset: SaveBody | null;
  missing: MissingItem[];
  missingCount: number;
  canUndo: boolean;
  canRedo: boolean;
  // meta do último `GET` (catálogo, manifest, línguas, limites, publicação)
  catalog: Catalog | null;
  manifest: Manifest | null;
  /**
   * O site tem manifest com fundos (um manifest válido tem sempre 1–20). Sem eles não se cria nenhum bloco
   * nem componente: a API recusava tudo com `422 BAD_BG`. As páginas sem blocos continuam a poder criar-se.
   */
  configured: boolean;
  lang: LangCtx;
  limits: Record<string, unknown>;
  publish: GetCmsSiteBuilder200["publish"];
  /** Nome do site para o " · <site>" da pré-visualização do Google. */
  siteName: string;
  /** Endereços antigos que o servidor tem (só leitura: a API cria-os e apaga-os sozinha). */
  redirects: { fromPath: string; pageId: string }[];
  /** Alteração à cópia de trabalho. `key` junta escrita seguida no mesmo campo (≤ 1,5 s) numa entrada. */
  edit: (update: (w: Work) => Work, key?: string) => void;
  /** Operação da lista lateral (mover, criar página/pasta…) — passa pelo reducer, logo entra no desfazer. */
  apply: (op: WorkOp) => void;
  undo: () => void;
  redo: () => void;
  select: (patch: { pageId?: string | null; libId?: string | null; sel?: Sel; tab?: PageTab }) => void;
  /** "Ver onde": leva ao seguinte campo por traduzir. */
  goToMissing: () => MissingItem | null;
  /** `true` se gravou. Bloqueado (e leva ao 1.º campo em falta) se faltam traduções. */
  save: () => Promise<boolean>;
  /** Largar o trabalho e voltar a ler o servidor ("Recarregar" do 409). */
  reload: () => Promise<void>;
  /** Fechar o aviso (409/422/erro) sem recarregar — o trabalho fica. */
  dismiss: () => void;
  publishNow: () => Promise<boolean>;
}

const BuilderContext = createContext<Builder | null>(null);

export function useBuilder(): Builder {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder tem de estar dentro de <BuilderProvider>");
  return ctx;
}

const isTyping = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

interface ProviderProps {
  /** Resposta do `GET` com `enabled:true`. Só a 1.ª serve de base ao trabalho; as seguintes actualizam a meta. */
  data: GetCmsSiteBuilder200;
  /** Nome do tenant (o `GET` não traz o nome do site): vai no " · <site>" do título no Google. */
  siteName?: string;
  /** Volta a pedir o `GET` (para o "Recarregar"). */
  refetch: () => Promise<GetCmsSiteBuilder200 | undefined>;
  children?: ReactNode;
}

export function BuilderProvider({ data, siteName = "", refetch, children }: ProviderProps) {
  const [state, dispatch] = useReducer(reduce, undefined, () => initState(fromServer(data), data.revision ?? 0));
  const latest = useRef(state);
  latest.current = state;

  const queryClient = useQueryClient();
  const { mutateAsync: saveAsync } = useSaveSiteBuilder();
  const { mutateAsync: publishAsync } = usePublishSiteBuilder();

  const catalog = (data.catalog as Catalog | undefined) ?? null;
  const manifest = (data.manifest as Manifest | null | undefined) ?? null;
  const defaultLanguage = data.defaultLanguage ?? data.languages?.[0] ?? "pt";
  const lang = useMemo<LangCtx>(
    () => ({ languages: data.languages?.length ? data.languages : [defaultLanguage], defaultLanguage }),
    [data.languages, defaultLanguage],
  );

  const changeset = useMemo(() => buildChangeset(state.server, state.work, state.revision), [state.server, state.work, state.revision]);
  const missing = useMemo(() => findMissing(state.work, catalog, manifest, lang), [state.work, catalog, manifest, lang]);
  const missingRef = useRef(missing);
  missingRef.current = missing;
  const dirty = changeset !== null;

  const edit = useCallback((update: (w: Work) => Work, key?: string) => dispatch({ type: "edit", update, key }), []);
  const apply = useCallback((op: WorkOp) => dispatch({ type: "op", op }), []);
  const undoFn = useCallback(() => dispatch({ type: "undo" }), []);
  const redoFn = useCallback(() => dispatch({ type: "redo" }), []);
  const select = useCallback(
    (patch: { pageId?: string | null; libId?: string | null; sel?: Sel; tab?: PageTab }) => dispatch({ type: "select", ...patch }),
    [],
  );
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);

  const goToMissing = useCallback((): MissingItem | null => {
    const target = firstMissing(missingRef.current, latest.current.focus);
    if (!target) return null;
    // Páginas (nome, SEO) vivem em "Definições e SEO"; o resto no editor do bloco/parte/especial.
    dispatch({ type: "select", libId: null, ...locateMissing(latest.current.work, target), tab: target.entity === "page" ? "settings" : "content", focus: target });
    return target;
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const s = latest.current;
    if (s.status === "saving") return false;
    if (missingRef.current.length > 0) {
      goToMissing();
      return false;
    }
    if (!buildChangeset(s.server, s.work, s.revision)) return false;
    dispatch({ type: "saveStart" });
    // Upload diferido: só agora sobem os ficheiros escolhidos. Se um falhar, nada é gravado.
    let sent = s.work;
    if (hasPending(s.work)) {
      try {
        const up = await uploadPending(s.work);
        sent = up.work;
        dispatch({ type: "mediaUploaded", map: up.map });
      } catch (err) {
        const message = err instanceof PendingUploadError ? err.message : readApiFailure(err).message;
        dispatch({ type: "failed", failure: { status: null, message, data: {} } });
        return false;
      }
    }
    const body = buildChangeset(s.server, sent, s.revision);
    if (!body) return false;
    try {
      const res = await saveAsync({ data: body });
      dispatch({ type: "saveOk", revision: res.revision, sent });
      toast.success("Guardado. O site actualiza dentro de 1 a 2 minutos.");
      void queryClient.invalidateQueries({ queryKey: siteBuilderQueryKey() });
      return true;
    } catch (err) {
      const f = readApiFailure(err);
      if (f.status === 409 && f.code === "REVISION_CONFLICT") {
        dispatch({ type: "conflict", revision: typeof f.data.revision === "number" ? f.data.revision : null });
      } else if (f.status === 422 && Array.isArray(f.data.issues)) {
        dispatch({ type: "invalid", issues: f.data.issues as Issue[] });
      } else {
        dispatch({ type: "failed", failure: f });
      }
      return false;
    }
  }, [goToMissing, queryClient, saveAsync]);

  const reload = useCallback(async () => {
    const fresh = await refetch();
    if (fresh?.enabled) dispatch({ type: "load", work: fromServer(fresh), revision: fresh.revision ?? 0 });
  }, [refetch]);

  const publishNow = useCallback(async (): Promise<boolean> => {
    try {
      await publishAsync(undefined);
      toast.success("A publicar no site…");
      void queryClient.invalidateQueries({ queryKey: siteBuilderQueryKey() });
      return true;
    } catch (err) {
      toast.error(publishErrorMessage(readApiFailure(err)));
      // 409 IN_PROGRESS / 429: o estado real pode ter mudado — volta a ler.
      void queryClient.invalidateQueries({ queryKey: siteBuilderQueryKey() });
      return false;
    }
  }, [publishAsync, queryClient]);

  // Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y — nunca dentro de caixas de texto (lá o browser desfaz o texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) dispatch({ type: "undo" });
      else if ((k === "z" && e.shiftKey) || k === "y") dispatch({ type: "redo" });
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Fechar o separador com trabalho por gravar.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const value = useMemo<Builder>(
    () => ({
      state,
      dirty,
      changeset,
      missing,
      missingCount: countMissing(missing),
      canUndo: canUndo(state.history),
      canRedo: canRedo(state.history),
      catalog,
      manifest,
      configured: (manifest?.backgrounds?.length ?? 0) > 0,
      lang,
      limits: (data.limits as Record<string, unknown> | undefined) ?? {},
      publish: data.publish,
      siteName,
      redirects: asRedirects(data.redirects),
      edit,
      apply,
      undo: undoFn,
      redo: redoFn,
      select,
      goToMissing,
      save,
      reload,
      dismiss,
      publishNow,
    }),
    [state, dirty, changeset, missing, catalog, manifest, lang, data.limits, data.publish, data.redirects, siteName, edit, apply, undoFn, redoFn, select, goToMissing, save, reload, dismiss, publishNow],
  );

  return createElement(BuilderContext.Provider, { value }, children);
}

/** Dica dos botões desligados quando o site não tem manifest com fundos (ver `Builder.configured`). */
export const NOT_CONFIGURED_HINT = "Este site ainda não está configurado para o construtor.";
