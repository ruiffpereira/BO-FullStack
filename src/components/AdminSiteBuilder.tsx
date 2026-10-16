import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../lib/apiError";
import { isImpersonationForbiddenError } from "../lib/supportSession";
import { Badge, Button, Input, Modal, Select, SectionTitle } from "../ui/ui.jsx";
import { GuardButton } from "./GuardButton";
import {
  useGetAdminUsersUseridSiteBuilder,
  getAdminUsersUseridSiteBuilderQueryKey,
} from "../gen/backoffice/hooks/useGetAdminUsersUseridSiteBuilder.js";
import { usePutAdminUsersUseridSiteBuilder } from "../gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilder.js";
import { usePutAdminUsersUseridSiteBuilderManifest } from "../gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilderManifest.js";
import { usePutAdminUsersUseridSiteBuilderPublish } from "../gen/backoffice/hooks/usePutAdminUsersUseridSiteBuilderPublish.js";
import { usePostAdminUsersUseridSiteBuilderPublishTest } from "../gen/backoffice/hooks/usePostAdminUsersUseridSiteBuilderPublishTest.js";
import type { PutAdminUsersUseridSiteBuilderManifestMutationRequest as ManifestBody } from "../gen/backoffice/types/PutAdminUsersUseridSiteBuilderManifest";
import type { PutAdminUsersUseridSiteBuilderPublishMutationRequest as PublishBody } from "../gen/backoffice/types/PutAdminUsersUseridSiteBuilderPublish";

/**
 * Admin → Utilizadores → "Construtor de páginas" (F16, CONTRATO §5.4): ver se está activo, carregar o manifest e
 * configurar a publicação de um tenant. Não há interruptor: o construtor está activo quando o tenant tem
 * `VIEW_SITE_PAGES` (decisão do dono, 2026-10-16). Só o dono da plataforma (`VIEW_ADMIN`) chega aqui; em sessão de
 * suporte a API responde `403 IMPERSONATION_FORBIDDEN` e mostra-se a mensagem. O token do GitHub é só de
 * escrita: nunca vem na resposta, o campo nunca é preenchido e, vazio, não é enviado (a API mantém o antigo).
 */

// ── erros do manifest (puro, testável) ─────────────────────────────────────────

interface ApiIssue { code?: string; entity?: string; id?: string; path?: string; message?: string }
interface ApiUsage { kind?: string; key?: string; entity?: string; id?: string; path?: string }

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
  if (isImpersonationForbiddenError(status, data)) return { kind: "message", message: IMPERSONATION_MESSAGE };
  if (status === 422 && Array.isArray(data.issues)) {
    return {
      kind: "issues",
      issues: (data.issues as ApiIssue[]).map((i) => {
        const where = i.path ? `${i.path}: ` : "";
        return `${where}${i.message ?? i.code ?? "Valor inválido"}`;
      }),
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
  return { kind: "message", message: getApiError(err, "Não foi possível guardar o manifest.") };
}

const IMPERSONATION_MESSAGE = "Esta acção não está disponível numa sessão de suporte.";

/** Corpo do `PUT …/publish`: o token só segue se foi escrito; `runtime` não toca no resto. */
export function buildPublishBody(f: { mode: "runtime" | "github"; repo: string; workflow: string; ref: string; token: string }): PublishBody {
  const body: PublishBody = { mode: f.mode };
  if (f.mode === "github") {
    body.repo = f.repo.trim();
    body.workflow = f.workflow.trim();
    body.ref = f.ref.trim();
    if (f.token.trim()) body.token = f.token.trim();
  }
  return body;
}

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  idle: { label: "Sem publicações", tone: "neutral" },
  pending: { label: "À espera de publicar", tone: "blue" },
  running: { label: "A publicar", tone: "blue" },
  live: { label: "No ar", tone: "green" },
  failed: { label: "Falhou", tone: "red" },
};

const errMessage = (err: unknown, fallback: string) => {
  const e = err as { response?: { status?: number; data?: unknown } } | null;
  if (isImpersonationForbiddenError(e?.response?.status, e?.response?.data)) return IMPERSONATION_MESSAGE;
  // O 400 do PUT do construtor traz `error: [{ path, message }]` (zod) em vez de uma frase.
  const list = (e?.response?.data as { error?: unknown } | undefined)?.error;
  if (Array.isArray(list) && typeof list[0]?.message === "string") return list[0].message;
  return getApiError(err, fallback);
};

// ── modal ──────────────────────────────────────────────────────────────────────

export function SiteBuilderModal({ user, onClose }: { user: { userId: string; name: string }; onClose: () => void }) {
  const { authHeader } = useAuth();
  const headers = authHeader();
  const qc = useQueryClient();
  const { userId } = user;
  const refresh = () => qc.invalidateQueries({ queryKey: getAdminUsersUseridSiteBuilderQueryKey(userId) });

  const q = useGetAdminUsersUseridSiteBuilder(userId, { client: { headers } });
  const data = q.data;
  const publish = data?.publish;

  // Formulário da publicação: copia o que a API tem, menos o token (nunca vem de lá).
  const [mode, setMode] = useState<"runtime" | "github">("runtime");
  const [repo, setRepo] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [ref, setRef] = useState("");
  const [token, setToken] = useState("");
  const synced = useRef("");
  useEffect(() => {
    if (!publish) return;
    const key = JSON.stringify([publish.mode, publish.repo, publish.workflow, publish.ref]);
    if (synced.current === key) return;
    synced.current = key;
    setMode(publish.mode === "github" ? "github" : "runtime");
    setRepo(publish.repo ?? "");
    setWorkflow(publish.workflow ?? "");
    setRef(publish.ref ?? "");
  }, [publish]);

  const [manifestText, setManifestText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [failure, setFailure] = useState<ManifestFailure | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState("");

  // Nome do site: copia o da API quando muda lá (como o formulário da publicação).
  const [siteName, setSiteName] = useState("");
  const savedName = data?.siteName ?? "";
  useEffect(() => setSiteName(savedName), [savedName]);
  const nameM = usePutAdminUsersUseridSiteBuilder({
    client: { headers },
    mutation: {
      onSuccess: () => {
        setActionError("");
        toast.success("Nome do site guardado");
        void refresh();
      },
      onError: (e) => setActionError(errMessage(e, "Não foi possível guardar o nome do site.")),
    },
  });
  const manifestM = usePutAdminUsersUseridSiteBuilderManifest({
    client: { headers },
    mutation: {
      onSuccess: () => {
        setFailure(null);
        setManifestText("");
        setFileName("");
        toast.success("Manifest carregado");
        void refresh();
      },
      onError: (e) => setFailure(manifestFailure(e)),
    },
  });
  const publishM = usePutAdminUsersUseridSiteBuilderPublish({
    client: { headers },
    mutation: {
      onSuccess: () => {
        setActionError("");
        setToken("");
        setTestResult(null);
        toast.success("Publicação guardada");
        void refresh();
      },
      onError: (e) => setActionError(errMessage(e, "Não foi possível guardar a publicação.")),
    },
  });
  const testM = usePostAdminUsersUseridSiteBuilderPublishTest({
    client: { headers },
    mutation: {
      onSuccess: (r) => setTestResult({ ok: !!r?.ok, message: r?.message ?? (r?.ok ? "Ligação confirmada." : "A ligação falhou.") }),
      onError: (e) => setTestResult({ ok: false, message: errMessage(e, "Não foi possível testar a ligação.") }),
    },
  });

  const loadManifest = () => {
    setFailure(null);
    setParseError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestText);
    } catch (e) {
      setParseError(`O texto não é JSON válido (${(e as Error).message}).`);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setParseError("O manifest tem de ser um objecto JSON.");
      return;
    }
    manifestM.mutate({ userId, data: parsed as ManifestBody });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFailure(null);
    setParseError("");
    setManifestText(await file.text());
  };

  const github = mode === "github";
  const savedMode = publish?.mode ?? "runtime";
  // "Testar" usa a configuração JÁ guardada: com o formulário alterado dava um resultado enganador.
  const formDirty =
    mode !== savedMode ||
    (github && (repo !== (publish?.repo ?? "") || workflow !== (publish?.workflow ?? "") || ref !== (publish?.ref ?? ""))) ||
    (github && token.trim() !== "");
  // Em `runtime` o estado fica `idle` (não há workflow), mas o site está no ar desde a última gravação (`liveAt`).
  const live = publish?.status === "live" || (publish?.mode === "runtime" && !!publish.liveAt);
  const status = live ? STATUS_LABEL.live : STATUS_LABEL[publish?.status ?? "idle"] ?? STATUS_LABEL.idle;
  const liveAt = live && publish?.liveAt ? ` · ${new Date(publish.liveAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : "";
  const summary = data?.manifestSummary;
  const forbidden = q.isError && isImpersonationForbiddenError((q.error as any)?.response?.status, (q.error as any)?.response?.data);

  return (
    <Modal open onClose={onClose} title="Construtor de páginas" subtitle={user.name} width="max-w-2xl"
      footer={<Button variant="ghost" className="min-h-10" onClick={onClose}>Fechar</Button>}>
      {q.isLoading ? (
        <p role="status" className="text-sm text-zinc-500">A carregar…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {forbidden ? IMPERSONATION_MESSAGE : "Não foi possível carregar o estado do construtor."}
        </p>
      ) : (
        <div className="space-y-6">
          {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

          <section aria-label="Estado">
            <SectionTitle>Estado</SectionTitle>
            <Badge tone={data?.enabled ? "green" : "neutral"} dot>{data?.enabled ? "Activo" : "Inactivo"}</Badge>
            <p className="mt-3 text-[13px] text-zinc-500">
              {data?.enabled
                ? <>Activo porque a role do tenant tem <code className="text-[12px]">VIEW_SITE_PAGES</code>; tirá-la desliga o construtor (os dados ficam). Gere-se em{" "}</>
                : <>Para activar, dá <code className="text-[12px]">VIEW_SITE_PAGES</code> à role do tenant em{" "}</>}
              <Link to="/admin/permissoes" onClick={onClose} className="text-accent underline underline-offset-2">Admin → Permissões</Link>.
            </p>
          </section>

          <section aria-label="Nome do site">
            <SectionTitle>Nome do site</SectionTitle>
            <p className="text-[13px] text-zinc-500 mb-3">
              Aparece no título de cada página no Google («Página · Nome») e na ficha da empresa. Mudá-lo publica o site de novo.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input label="Nome" value={siteName} maxLength={80} onChange={(e: any) => setSiteName(e.target.value)} placeholder={user.name} autoComplete="off" />
              </div>
              <GuardButton
                className="min-h-10"
                isLoading={nameM.isPending}
                disabled={siteName.trim() === savedName || nameM.isPending}
                onClick={() => nameM.mutate({ userId, data: { siteName: siteName.trim() || null } })}
              >
                Guardar nome
              </GuardButton>
            </div>
          </section>

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
                  value={manifestText}
                  onChange={(e) => { setManifestText(e.target.value); setFailure(null); setParseError(""); }}
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
                  <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words">{failure.issues.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
              {failure?.kind === "inUse" && (
                <div role="alert" className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">Não foi gravado: o manifest novo tira coisas que o cliente está a usar.</p>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words">{failure.usages.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
              <GuardButton className="min-h-10" isLoading={manifestM.isPending} disabled={!manifestText.trim() || manifestM.isPending} onClick={loadManifest}>
                Carregar manifest
              </GuardButton>
            </div>
          </section>

          <section aria-label="Publicação">
            <SectionTitle right={<Badge tone={status.tone}>{status.label}{liveAt}</Badge>}>Publicação</SectionTitle>
            <div className="space-y-3">
              <Select label="Modo" value={mode} onChange={(e: any) => setMode(e.target.value === "github" ? "github" : "runtime")}>
                <option value="runtime">Em runtime (o site lê a API)</option>
                <option value="github">GitHub Actions (site estático)</option>
              </Select>
              {github && (
                <>
                  <Input label="Repositório" value={repo} onChange={(e: any) => setRepo(e.target.value)} placeholder="dono/repo" autoComplete="off" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="Workflow" value={workflow} onChange={(e: any) => setWorkflow(e.target.value)} placeholder="deploy.yml" autoComplete="off" />
                    <Input label="Ref (branch)" value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="main" autoComplete="off" />
                  </div>
                  <Input
                    label={publish?.hasToken ? "Token do GitHub — definido (escreve para trocar)" : "Token do GitHub"}
                    type="password"
                    value={token}
                    onChange={(e: any) => setToken(e.target.value)}
                    placeholder={publish?.hasToken ? "Deixa vazio para manter o actual" : "github_pat_…"}
                    hint="Fine-grained, de um só repositório, só Actions: write. Só de escrita — nunca é mostrado depois de guardado."
                    autoComplete="new-password"
                  />
                </>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <GuardButton className="min-h-10" isLoading={publishM.isPending} disabled={publishM.isPending || !formDirty}
                  onClick={() => publishM.mutate({ userId, data: buildPublishBody({ mode, repo, workflow, ref, token }) })}>
                  Guardar publicação
                </GuardButton>
                <Button variant="outline" className="min-h-10" isLoading={testM.isPending}
                  disabled={testM.isPending || formDirty || !(publish?.mode === "github")}
                  title={formDirty ? "Guarda a publicação antes de testar." : "Confirma que o token chega ao workflow."}
                  onClick={() => { setTestResult(null); testM.mutate({ userId }); }}>
                  Testar
                </Button>
              </div>
              {testResult && (
                <p role="status" className={`text-sm ${testResult.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
                  {testResult.ok ? "Ligação confirmada: " : "Falhou: "}{testResult.message}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
