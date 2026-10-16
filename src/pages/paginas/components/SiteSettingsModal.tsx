/**
 * «Definições do site» (Páginas). O cliente edita o **nome do site** (o « · Nome» do título no Google e a ficha da
 * empresa). Numa **sessão de suporte** (o dono entrou na conta com "Entrar como") aparecem também o **manifest** e a
 * **publicação** — a API recusa essas rotas fora de suporte (`403 SUPPORT_SESSION_REQUIRED`), isto só as esconde.
 * A publicação é sempre GitHub: basta o repositório; workflow/branch/token são opcionais (`deploy.yml`, `main` e o
 * token global da plataforma). O token é só de escrita: nunca vem na resposta e, vazio, não é enviado.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { getApiError } from "../../../lib/apiError";
import { Badge, Button, Input, Modal, SectionTitle } from "../../../ui/ui.jsx";
import { GuardButton } from "../../../components/GuardButton";
import { siteBuilderQueryKey, useSiteBuilderQuery } from "../../../hooks/useSiteBuilder";
import { usePutCmsSiteBuilderSettings } from "../../../gen/backoffice/hooks/usePutCmsSiteBuilderSettings.js";
import { useGetCmsSiteBuilderSupport, getCmsSiteBuilderSupportQueryKey } from "../../../gen/backoffice/hooks/useGetCmsSiteBuilderSupport.js";
import { usePutCmsSiteBuilderSupportManifest } from "../../../gen/backoffice/hooks/usePutCmsSiteBuilderSupportManifest.js";
import { usePutCmsSiteBuilderSupportPublish } from "../../../gen/backoffice/hooks/usePutCmsSiteBuilderSupportPublish.js";
import { usePostCmsSiteBuilderSupportPublishTest } from "../../../gen/backoffice/hooks/usePostCmsSiteBuilderSupportPublishTest.js";
import type { PutCmsSiteBuilderSupportManifestMutationRequest as ManifestBody } from "../../../gen/backoffice/types/PutCmsSiteBuilderSupportManifest";
import type { PutCmsSiteBuilderSupportPublishMutationRequest as PublishBody } from "../../../gen/backoffice/types/PutCmsSiteBuilderSupportPublish";
import { useBuilder } from "../state/store";

// ── puro, testável ─────────────────────────────────────────────────────────────

interface ApiIssue { code?: string; path?: string; message?: string }
interface ApiUsage { kind?: string; key?: string; entity?: string }

export type ManifestFailure =
  | { kind: "issues"; issues: string[] }
  | { kind: "inUse"; usages: string[] }
  | { kind: "message"; message: string };

const USAGE_KIND: Record<string, string> = { style: "Estilo", background: "Fundo", icon: "Ícone", special: "Especial" };
const USAGE_WHERE: Record<string, string> = { block: "num bloco", part: "numa parte comum (topo/rodapé)", item: "numa página" };

export function manifestFailure(err: unknown): ManifestFailure {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } } | null;
  const status = e?.response?.status;
  const data = e?.response?.data ?? {};
  if (status === 422 && Array.isArray(data.issues)) {
    return {
      kind: "issues",
      issues: (data.issues as ApiIssue[]).map((i) => `${i.path ? `${i.path}: ` : ""}${i.message ?? i.code ?? "Valor inválido"}`),
    };
  }
  if (status === 409 && data.code === "MANIFEST_IN_USE" && Array.isArray(data.usages)) {
    return {
      kind: "inUse",
      usages: (data.usages as ApiUsage[]).map(
        (u) => `${USAGE_KIND[u.kind ?? ""] ?? "Valor"} "${u.key ?? "?"}" — ${USAGE_WHERE[u.entity ?? ""] ?? "em uso"}`,
      ),
    };
  }
  if (status === 413) return { kind: "message", message: "O manifest é demasiado grande (máximo 1 MB)." };
  return { kind: "message", message: errMessage(err, "Não foi possível guardar o manifest.") };
}

/** Corpo do `PUT /support/publish`: vazio = valor por omissão (`null`); o token só segue se foi escrito. */
export function buildPublishBody(f: { repo: string; workflow: string; ref: string; token: string }): PublishBody {
  const body: PublishBody = { repo: f.repo.trim(), workflow: f.workflow.trim() || null, ref: f.ref.trim() || null };
  if (f.token.trim()) body.token = f.token.trim();
  return body;
}

export function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: unknown } } | null;
  // Os 400 do zod trazem `error: [{ path, message }]` em vez de uma frase.
  const list = (e?.response?.data as { error?: unknown } | undefined)?.error;
  if (Array.isArray(list) && typeof list[0]?.message === "string") return list[0].message;
  return getApiError(err, fallback);
}

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  idle: { label: "Por configurar", tone: "neutral" },
  pending: { label: "À espera de publicar", tone: "blue" },
  running: { label: "A publicar", tone: "blue" },
  live: { label: "No ar", tone: "green" },
  failed: { label: "Falhou", tone: "red" },
};

// ── modal ──────────────────────────────────────────────────────────────────────

export function SiteSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { supportSession } = useAuth();
  return (
    <Modal open={open} onClose={onClose} title="Definições do site" width="max-w-2xl"
      footer={<Button variant="ghost" className="min-h-10" onClick={onClose}>Fechar</Button>}>
      {open && (
        <div className="space-y-6">
          <SiteNameSection />
          {supportSession && <SupportSections />}
        </div>
      )}
    </Modal>
  );
}

function SiteNameSection() {
  const { dirty, adoptRevision } = useBuilder();
  const query = useSiteBuilderQuery();
  const saved = query.data?.siteName ?? "";
  const [name, setName] = useState(saved);
  const [error, setError] = useState("");
  useEffect(() => setName(saved), [saved]);
  const m = usePutCmsSiteBuilderSettings({
    mutation: {
      onSuccess: (r) => {
        setError("");
        toast.success("Nome do site guardado");
        if (typeof r?.revision === "number") adoptRevision(r.revision);
      },
      onError: (e) => setError(errMessage(e, "Não foi possível guardar o nome do site.")),
    },
  });
  const changed = name.trim() !== saved;
  return (
    <section aria-label="Nome do site">
      <SectionTitle>Nome do site</SectionTitle>
      <p className="text-[13px] text-zinc-500 mb-3">
        Aparece no título de cada página no Google («Página · Nome») e na ficha da empresa. Mudá-lo publica o site de novo.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input label="Nome" value={name} maxLength={80} onChange={(e: any) => setName(e.target.value)} autoComplete="off" />
        </div>
        <GuardButton
          className="min-h-10"
          isLoading={m.isPending}
          disabled={!changed || m.isPending || dirty}
          title={dirty ? "Guarda primeiro as alterações às páginas." : undefined}
          onClick={() => m.mutate({ data: { siteName: name.trim() || null } })}
        >
          Guardar nome
        </GuardButton>
      </div>
      {dirty && changed && <p className="text-xs text-zinc-500 mt-2">Guarda primeiro as alterações às páginas.</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </section>
  );
}

function SupportSections() {
  const qc = useQueryClient();
  const q = useGetCmsSiteBuilderSupport({ query: { refetchOnWindowFocus: false } });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getCmsSiteBuilderSupportQueryKey() });
    void qc.invalidateQueries({ queryKey: siteBuilderQueryKey() });
  };
  if (q.isLoading) return <p role="status" className="text-sm text-zinc-500">A carregar…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar as definições de suporte.</p>;
  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-[13px] text-zinc-500">
        Só visível numa sessão de suporte — o cliente não vê o manifest nem a publicação.
      </div>
      <ManifestSection summary={q.data?.manifestSummary} onDone={refresh} />
      <PublishSection publish={q.data?.publish} onDone={refresh} />
    </>
  );
}

type Summary = { version?: number | null; styleTypes?: number; backgrounds?: number; icons?: number; specials?: string[] } | null | undefined;

function ManifestSection({ summary, onDone }: { summary: Summary; onDone: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [failure, setFailure] = useState<ManifestFailure | null>(null);
  const m = usePutCmsSiteBuilderSupportManifest({
    mutation: {
      onSuccess: () => {
        setFailure(null);
        setText("");
        setFileName("");
        toast.success("Manifest carregado");
        onDone();
      },
      onError: (e) => setFailure(manifestFailure(e)),
    },
  });
  const load = () => {
    setFailure(null);
    setParseError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setParseError(`O texto não é JSON válido (${(e as Error).message}).`);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setParseError("O manifest tem de ser um objecto JSON.");
      return;
    }
    m.mutate({ data: parsed as ManifestBody });
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFailure(null);
    setParseError("");
    setText(await file.text());
  };
  return (
    <section aria-label="Manifest">
      <SectionTitle>Manifest do site</SectionTitle>
      <p className="text-[13px] text-zinc-500 mb-3">
        {summary
          ? `Carregado: versão ${summary.version ?? "?"}, ${summary.styleTypes ?? 0} tipos com estilos, ${summary.backgrounds ?? 0} fundos, ${summary.icons ?? 0} ícones, ${summary.specials?.length ?? 0} especiais${summary.specials?.length ? ` (${summary.specials.join(", ")})` : ""}.`
          : "Ainda não há manifest. O site só pode usar o núcleo, sem estilos nem especiais."}
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Ficheiro .json</span>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Ficheiro do manifest"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-sm text-zinc-600 dark:text-zinc-300 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3.5 file:text-sm file:font-medium dark:file:bg-zinc-800"
          />
          {fileName && <span className="block text-xs text-zinc-400 mt-1">{fileName}</span>}
        </label>
        <label className="block">
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Ou cola o JSON</span>
          <textarea
            aria-label="Manifest (JSON)"
            value={text}
            onChange={(e) => { setText(e.target.value); setFailure(null); setParseError(""); }}
            rows={6}
            spellCheck={false}
            placeholder='{ "version": 1, "backgrounds": [ … ] }'
            className="w-full font-mono text-[12px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {parseError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}
        {failure?.kind === "message" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{failure.message}</p>}
        {failure?.kind === "issues" && (
          <div role="alert" className="rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <p className="font-medium">O manifest não é válido ({failure.issues.length} {failure.issues.length === 1 ? "problema" : "problemas"}):</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words">{failure.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {failure?.kind === "inUse" && (
          <div role="alert" className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-medium">Não foi gravado: o manifest novo tira coisas que o site está a usar.</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words">{failure.usages.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        <GuardButton className="min-h-10" isLoading={m.isPending} disabled={!text.trim() || m.isPending} onClick={load}>
          Carregar manifest
        </GuardButton>
      </div>
    </section>
  );
}

type PublishCfg = {
  mode?: string; repo?: string | null; workflow?: string | null; ref?: string | null;
  hasToken?: boolean; usesGlobalToken?: boolean; status?: string; liveAt?: string | null;
} | undefined;

function PublishSection({ publish, onDone }: { publish: PublishCfg; onDone: () => void }) {
  const [repo, setRepo] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [ref, setRef] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const synced = useRef("");
  useEffect(() => {
    if (!publish) return;
    const key = JSON.stringify([publish.repo, publish.workflow, publish.ref]);
    if (synced.current === key) return;
    synced.current = key;
    setRepo(publish.repo ?? "");
    setWorkflow(publish.workflow ?? "");
    setRef(publish.ref ?? "");
  }, [publish]);

  const saveM = usePutCmsSiteBuilderSupportPublish({
    mutation: {
      onSuccess: () => {
        setError("");
        setToken("");
        setTest(null);
        toast.success("Publicação guardada");
        onDone();
      },
      onError: (e) => setError(errMessage(e, "Não foi possível guardar a publicação.")),
    },
  });
  const testM = usePostCmsSiteBuilderSupportPublishTest({
    mutation: {
      onSuccess: (r) => setTest({ ok: !!r?.ok, message: r?.message ?? (r?.ok ? "Ligação confirmada." : "A ligação falhou.") }),
      onError: (e) => setTest({ ok: false, message: errMessage(e, "Não foi possível testar a ligação.") }),
    },
  });

  const configured = publish?.mode === "github" && !!publish.repo;
  const dirty =
    repo.trim() !== (publish?.repo ?? "") ||
    workflow.trim() !== (publish?.workflow ?? "") ||
    ref.trim() !== (publish?.ref ?? "") ||
    token.trim() !== "";
  const live = publish?.status === "live";
  const status = STATUS_LABEL[configured ? publish?.status ?? "idle" : "idle"] ?? STATUS_LABEL.idle;
  const liveAt = live && publish?.liveAt ? ` · ${new Date(publish.liveAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : "";
  const tokenLabel = publish?.hasToken
    ? "Token do GitHub — próprio deste site (escreve para trocar)"
    : publish?.usesGlobalToken
      ? "Token do GitHub — usa o da plataforma (opcional)"
      : "Token do GitHub";

  return (
    <section aria-label="Publicação">
      <SectionTitle right={<Badge tone={status.tone}>{status.label}{liveAt}</Badge>}>Publicação (GitHub)</SectionTitle>
      <div className="space-y-3">
        <Input label="Repositório" value={repo} onChange={(e: any) => setRepo(e.target.value)} placeholder="ruiffpereira/site" autoComplete="off" />
        <details className="group rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
          <summary className="cursor-pointer select-none min-h-8 flex items-center text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Avançado</summary>
          <div className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Workflow" value={workflow} onChange={(e: any) => setWorkflow(e.target.value)} placeholder="deploy.yml" autoComplete="off" />
              <Input label="Branch" value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="main" autoComplete="off" />
            </div>
            <Input
              label={tokenLabel}
              type="password"
              value={token}
              onChange={(e: any) => setToken(e.target.value)}
              placeholder={publish?.hasToken ? "Deixa vazio para manter o actual" : "github_pat_…"}
              hint="Fine-grained, só Actions: write. Só de escrita — nunca é mostrado depois de guardado."
              autoComplete="new-password"
            />
          </div>
        </details>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <GuardButton className="min-h-10" isLoading={saveM.isPending} disabled={saveM.isPending || !dirty || !repo.trim()}
            onClick={() => saveM.mutate({ data: buildPublishBody({ repo, workflow, ref, token }) })}>
            Guardar publicação
          </GuardButton>
          <Button variant="outline" className="min-h-10" isLoading={testM.isPending}
            disabled={testM.isPending || dirty || !configured}
            title={dirty ? "Guarda a publicação antes de testar." : "Confirma que o token chega ao workflow."}
            onClick={() => { setTest(null); testM.mutate(); }}>
            Testar
          </Button>
        </div>
        {test && (
          <p role="status" className={`text-sm ${test.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
            {test.ok ? "Ligação confirmada: " : "Falhou: "}{test.message}
          </p>
        )}
      </div>
    </section>
  );
}
