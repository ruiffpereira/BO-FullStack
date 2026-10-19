/**
 * «Definições do site» (Páginas). O cliente edita o **nome do site** (o « · Nome» do título no Google e a ficha da
 * empresa). Numa **sessão de suporte** (o dono entrou na conta com "Entrar como") aparecem também o **«Migrar site»** (zip), o **manifest** e a
 * **publicação** — a API recusa essas rotas fora de suporte (`403 SUPPORT_SESSION_REQUIRED`), isto só as esconde.
 * A publicação é pelo Coolify: cola-se o webhook de deploy da app do site; a API guarda só a app e o `force` e chama
 * sempre o Coolify pelo endereço interno, com o token da env (nunca vem do Backoffice nem volta na resposta).
 * «Testar» confirma token, Coolify e app sem fazer deploy.
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
import { useImportSiteZip } from "../../../gen/backoffice/hooks/useImportSiteZip.js";
import type { ImportSiteZipMutationResponse as ImportResult } from "../../../gen/backoffice/types/ImportSiteZip";
import { usePutCmsSiteBuilderSupportManifest } from "../../../gen/backoffice/hooks/usePutCmsSiteBuilderSupportManifest.js";
import { usePutCmsSiteBuilderSupportPublish } from "../../../gen/backoffice/hooks/usePutCmsSiteBuilderSupportPublish.js";
import { usePostCmsSiteBuilderSupportPublishTest } from "../../../gen/backoffice/hooks/usePostCmsSiteBuilderSupportPublishTest.js";
import type { PutCmsSiteBuilderSupportManifestMutationRequest as ManifestBody } from "../../../gen/backoffice/types/PutCmsSiteBuilderSupportManifest";
import type { PutCmsSiteBuilderSupportPublishMutationRequest as PublishBody } from "../../../gen/backoffice/types/PutCmsSiteBuilderSupportPublish";
import type { PostCmsSiteBuilderSupportPublishTest200 } from "../../../gen/backoffice/types/PostCmsSiteBuilderSupportPublishTest";
import { useBuilder } from "../state/store";
import { defaultUploader } from "../state/pending";
import { SharePreview } from "./SharePreview";

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

/** Corpo do `PUT /support/publish`: o webhook colado, aparado; vazio = desligar (`null`). A API é que o valida. */
export function buildPublishBody(webhook: string): PublishBody {
  return { webhookUrl: webhook.trim() || null };
}

export function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: unknown } } | null;
  // Os 400 do zod trazem `error: [{ path, message }]` em vez de uma frase.
  const list = (e?.response?.data as { error?: unknown } | undefined)?.error;
  if (Array.isArray(list) && typeof list[0]?.message === "string") return list[0].message;
  return getApiError(err, fallback);
}

// ── Migrar site (zip): lógica pura ───────────────────────────────────────────────

export const IMPORT_MAX_BYTES = 60 * 1024 * 1024;

/** "850 B", "12,4 KB", "3,2 MB" (vírgula decimal, como no resto do BO). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const fmt = (n: number) => n.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`;
  return `${fmt(bytes / (1024 * 1024))} MB`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "9 páginas · 45 blocos · 0 pastas". */
export function importSummaryLine(s: { pages: number; blocks: number; folders: number }): string {
  return [plural(s.pages, "página", "páginas"), plural(s.blocks, "bloco", "blocos"), plural(s.folders, "pasta", "pastas")].join(" · ");
}

/** "PT · EN · FR" */
export function importLanguagesLine(languages: string[]): string {
  return languages.map((l) => l.toUpperCase()).join(" · ");
}

/** Texto do toast de sucesso. */
export function importDoneMessage(r: Pick<ImportResult, "summary">): string {
  return `Site importado: ${plural(r.summary.pages, "página", "páginas")}, ${plural(r.summary.blocks, "bloco", "blocos")}, ${plural(r.summary.files.length, "ficheiro", "ficheiros")}`;
}

/** Recusa no cliente só pela extensão e pelo tamanho; a API valida a sério. */
export function importFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.zip$/i.test(file.name)) return "O ficheiro tem de ser um .zip.";
  if (file.size > IMPORT_MAX_BYTES) return `O zip é demasiado grande (${formatBytes(file.size)}; máximo 60 MB).`;
  return null;
}

export function hasExistingContent(existing: { pages: number; blocks: number; parts?: number } | undefined): boolean {
  return !!existing && (existing.pages > 0 || existing.blocks > 0 || (existing.parts ?? 0) > 0);
}

/** O botão «Importar» só activa com uma verificação válida e, havendo conteúdo, a confirmação da substituição. */
export function canImport(o: { checked: boolean; existing?: { pages: number; blocks: number; parts?: number }; confirmReplace: boolean; busy: boolean; dirty: boolean }): boolean {
  if (!o.checked || o.busy || o.dirty) return false;
  return hasExistingContent(o.existing) ? o.confirmReplace : true;
}

export type ImportFailure =
  | { kind: "issues"; issues: string[] }
  | { kind: "inUse"; usages: string[] }
  | { kind: "message"; message: string };

/** Traduz o erro do import (dry-run ou apply) numa lista de problemas ou numa frase. */
export function importFailure(err: unknown): ImportFailure {
  const e = err as { response?: { status?: number; data?: Record<string, unknown> } } | null;
  const status = e?.response?.status;
  const data = e?.response?.data ?? {};
  if (status === 422 && Array.isArray(data.issues)) {
    return { kind: "issues", issues: (data.issues as ApiIssue[]).map((i) => `${i.path ? `${i.path}: ` : ""}${i.message ?? i.code ?? "Valor inválido"}`) };
  }
  if (status === 409) {
    if (data.code === "HAS_CONTENT") {
      return { kind: "message", message: `Este site já tem conteúdo (${plural(Number(data.pages) || 0, "página", "páginas")}, ${plural(Number(data.blocks) || 0, "bloco", "blocos")}). Escolhe o ficheiro outra vez e confirma a substituição.` };
    }
    if (data.code === "MANIFEST_IN_USE" && Array.isArray(data.usages)) {
      const f = manifestFailure(err);
      if (f.kind === "inUse") return f;
    }
    return { kind: "message", message: errMessage(err, "O site mudou entretanto e a importação foi recusada. Volta a escolher o ficheiro.") };
  }
  if (status === 413) return { kind: "message", message: "O zip é demasiado grande (máximo 60 MB, 300 ficheiros)." };
  if (status === 429) return { kind: "message", message: "Demasiados pedidos ou o servidor está ocupado a processar imagens. Tenta daqui a alguns minutos." };
  if (status === 503) return { kind: "message", message: "O armazenamento de ficheiros não está configurado — não é possível importar." };
  return { kind: "message", message: errMessage(err, "Não foi possível importar o site.") };
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
          <ShareImageSection />
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
          leaf="paginas.publicar"
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

/** Texto alternativo por língua, aparado; vazio sai (a API trata o mapa vazio como apagar). */
export function buildShareAlt(alt: Record<string, string>, languages: string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const l of languages) {
    const v = (alt[l] ?? "").trim();
    if (v) out[l] = v;
  }
  return Object.keys(out).length ? out : null;
}

const SHARE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * «Imagem de partilha» do site (B38 · P3): a que aparece no Facebook/WhatsApp/X quando uma página não tem imagem
 * própria, e o seu texto alternativo por língua. A imagem sobe logo ao escolher (fica na biblioteca), mas só passa a
 * ser a do site ao «Guardar imagem» — e guardar publica o site de novo, como o nome.
 */
function ShareImageSection() {
  const { dirty, adoptRevision, lang, siteName } = useBuilder();
  const query = useSiteBuilderQuery();
  const savedImage = query.data?.shareImage ?? null;
  const savedAlt = (query.data?.shareImageAlt ?? {}) as Record<string, string>;
  const languages = lang.languages.includes(lang.defaultLanguage) ? lang.languages : [lang.defaultLanguage, ...lang.languages];
  const [image, setImage] = useState<string | null>(savedImage);
  const [alt, setAlt] = useState<Record<string, string>>(savedAlt);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedKey = JSON.stringify([savedImage, buildShareAlt(savedAlt, languages)]);
  useEffect(() => {
    setImage(savedImage);
    setAlt(savedAlt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const m = usePutCmsSiteBuilderSettings({
    mutation: {
      onSuccess: (r) => {
        setError("");
        toast.success("Imagem de partilha guardada");
        if (typeof r?.revision === "number") adoptRevision(r.revision);
      },
      onError: (e) => setError(errMessage(e, "Não foi possível guardar a imagem de partilha.")),
    },
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!SHARE_IMAGE_TYPES.includes(file.type)) return setError("Ficheiro não aceite. JPEG, PNG ou WebP.");
    if (file.size > 10 * 1024 * 1024) return setError("O ficheiro é grande demais (máximo 10 MB).");
    setError("");
    setUploading(true);
    try {
      setImage(await defaultUploader(file, "image"));
    } catch (e) {
      setError(errMessage(e, "Não foi possível carregar a imagem."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const nextAlt = buildShareAlt(alt, languages);
  const changed = image !== savedImage || JSON.stringify(nextAlt) !== JSON.stringify(buildShareAlt(savedAlt, languages));
  const base = lang.defaultLanguage;

  return (
    <section aria-label="Imagem de partilha" data-testid="share-image-section">
      <SectionTitle>Imagem de partilha</SectionTitle>
      <p className="text-[13px] text-zinc-500 mb-3">
        Aparece no Facebook, WhatsApp, LinkedIn e X quando alguém partilha uma página que não tem imagem própria. Ideal: 1200×630.
      </p>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept={SHARE_IMAGE_TYPES.join(",")} className="hidden" data-testid="share-image-file"
            aria-label="Escolher a imagem de partilha" onChange={(e) => void pick(e.target.files?.[0])} />
          <Button variant="outline" className="min-h-10" isLoading={uploading} disabled={uploading} onClick={() => inputRef.current?.click()}>
            {image ? "Trocar imagem" : "Escolher imagem"}
          </Button>
          {image && !uploading && <Button variant="ghost" className="min-h-10" onClick={() => setImage(null)}>Tirar imagem</Button>}
        </div>
        {languages.map((l) => (
          <Input key={l} label={`Descrição da imagem (alt)${languages.length > 1 ? ` · ${l.toUpperCase()}` : ""}`} value={alt[l] ?? ""} maxLength={160}
            onChange={(e: any) => setAlt((a) => ({ ...a, [l]: e.target.value }))} autoComplete="off" />
        ))}
        <SharePreview image={image} alt={alt[base] ?? ""} title={siteName || "Página do site"} description="" siteName={siteName} />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 break-words">{error}</p>}
        <GuardButton
          leaf="paginas.publicar"
          className="min-h-10"
          data-testid="share-image-save"
          isLoading={m.isPending}
          disabled={!changed || m.isPending || uploading || dirty}
          title={dirty ? "Guarda primeiro as alterações às páginas." : undefined}
          onClick={() => m.mutate({ data: { shareImage: image, shareImageAlt: nextAlt } })}
        >
          Guardar imagem
        </GuardButton>
        {dirty && changed && <p className="text-xs text-zinc-500">Guarda primeiro as alterações às páginas.</p>}
      </div>
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
      <ImportSection onDone={refresh} />
      <ManifestSection summary={q.data?.manifestSummary} onDone={refresh} />
      <PublishSection publish={q.data?.publish} onDone={refresh} />
    </>
  );
}

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; result: ImportResult }
  | { state: "error"; failure: ImportFailure };

/** Ficheiro escolhido: o botão nativo tem de ler-se nos dois temas e um nome comprido não pode sair da caixa. */
const FILE_INPUT =
  // O nome que o Chromium escreve ao lado do botão transborda a 390 com nomes compridos: fica transparente (o nome
  // escolhido aparece por baixo, com o tamanho); o botão tem cor própria (`file:`).
  "block w-full max-w-full overflow-hidden text-sm text-transparent file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3.5 file:text-sm file:font-medium file:text-zinc-800 dark:file:bg-zinc-800 dark:file:text-zinc-100";

const ERROR_BOX = "rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";
const AMBER_BOX = "rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";

function FailureView({ failure, title }: { failure: ImportFailure; title: string }) {
  if (failure.kind === "message") return <p role="alert" data-testid="import-error" className="text-sm text-red-600 dark:text-red-400 break-words">{failure.message}</p>;
  const inUse = failure.kind === "inUse";
  const list = inUse ? failure.usages : failure.issues;
  return (
    <div role="alert" data-testid={inUse ? "import-error" : "import-issues"} className={inUse ? AMBER_BOX : ERROR_BOX}>
      <p className="font-medium">{inUse ? "O manifest do zip tira coisas que o site está a usar." : `${title} (${list.length} ${list.length === 1 ? "problema" : "problemas"}):`}</p>
      <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words max-h-48 overflow-auto">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function ImportSection({ onDone }: { onDone: () => void }) {
  const { dirty, reload } = useBuilder();
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applyError, setApplyError] = useState<ImportFailure | null>(null);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0); // ignora respostas de uma escolha anterior
  const m = useImportSiteZip<unknown>();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const id = ++seq.current;
    setApplyError(null);
    setConfirmReplace(false);
    setFile(f);
    const problem = importFileProblem(f);
    if (problem) {
      setCheck({ state: "error", failure: { kind: "message", message: problem } });
      return;
    }
    setCheck({ state: "checking" });
    try {
      const result = await m.mutateAsync({ data: { file: f, mode: "dry-run" } });
      if (id === seq.current) setCheck({ state: "ok", result });
    } catch (e) {
      if (id === seq.current) setCheck({ state: "error", failure: importFailure(e) });
    }
  };

  const reset = () => {
    seq.current++;
    setFile(null);
    setCheck({ state: "idle" });
    setConfirmReplace(false);
    setApplyError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const result = check.state === "ok" ? check.result : null;
  const existing = result?.existing;
  const replacing = hasExistingContent(existing);
  const ready = canImport({ checked: !!result, existing, confirmReplace, busy: applying || check.state === "checking", dirty });

  const run = async () => {
    if (!file || !result) return;
    setApplyError(null);
    setApplying(true);
    try {
      const done = await m.mutateAsync({ data: { file, mode: "apply", ...(replacing ? { replace: "true" as const } : {}) } });
      toast.success(importDoneMessage(done));
      reset();
      onDone();
      try { await reload(); } catch { /* o refetch já invalidado actualiza o editor */ }
    } catch (e) {
      setApplyError(importFailure(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <section aria-label="Migrar site" data-testid="import-section">
      <SectionTitle>Migrar site</SectionTitle>
      <p className="text-[13px] text-zinc-500 mb-3">
        Carrega o zip do site (manifest, conteúdo e ficheiros). Primeiro vês o que vai entrar; só depois importas.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Ficheiro .zip</span>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            aria-label="Zip do site"
            data-testid="import-file"
            disabled={applying}
            onChange={(e) => void pick(e.target.files?.[0])}
            className={FILE_INPUT}
          />
          {file && <span className="block text-xs text-zinc-400 mt-1 break-all">{file.name} · {formatBytes(file.size)}</span>}
        </label>

        {check.state === "checking" && <p role="status" data-testid="import-checking" className="text-sm text-zinc-500">A verificar…</p>}
        {check.state === "error" && <FailureView failure={check.failure} title="O zip não é válido" />}

        {result && (
          <div className="space-y-3" data-testid="import-result">
            <div data-testid="import-summary" className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm space-y-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{importSummaryLine(result.summary)}</p>
              {result.summary.languages.length > 0 && <p className="text-zinc-500">Línguas: {importLanguagesLine(result.summary.languages)}</p>}
              <div>
                <p className="text-zinc-500">{plural(result.summary.files.length, "ficheiro", "ficheiros")}</p>
                {result.summary.files.length > 0 && (
                  <ul data-testid="import-files" className="mt-1 max-h-48 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-[13px]">
                    {result.summary.files.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-3 py-1">
                        <span className="min-w-0 break-all">{f.name}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{f.kind === "pdf" ? "PDF" : "Imagem"} · {formatBytes(f.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {result.warnings.length > 0 && (
              <div data-testid="import-warnings" className={AMBER_BOX}>
                <p className="font-medium">Avisos</p>
                <ul className="mt-1 list-disc pl-5 space-y-0.5 break-words max-h-40 overflow-auto">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {replacing && existing && (
              <div data-testid="import-existing-warning" className={ERROR_BOX}>
                <p className="font-medium">
                  Este site já tem conteúdo ({plural(existing.pages, "página", "páginas")}, {plural(existing.blocks, "bloco", "blocos")}{existing.parts ? `, topo/rodapé` : ""}). Importar substitui tudo.
                </p>
                <label className="mt-2 flex items-start gap-2 cursor-pointer min-h-8">
                  <input type="checkbox" data-testid="import-confirm-replace" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
                  <span>Sim, substituir o conteúdo actual</span>
                </label>
              </div>
            )}
          </div>
        )}

        {applyError && <FailureView failure={applyError} title="Não foi possível importar" />}
        {result && dirty && <p className="text-xs text-zinc-500">Guarda primeiro as alterações às páginas.</p>}

        <div className="flex flex-wrap items-center gap-2">
          <GuardButton leaf="paginas.publicar" className="min-h-10" data-testid="import-submit" isLoading={applying} disabled={!ready} onClick={() => void run()}>
            {applying ? "A importar…" : "Importar"}
          </GuardButton>
          {file && !applying && <Button variant="ghost" className="min-h-10" onClick={reset}>Limpar</Button>}
        </div>
      </div>
    </section>
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
            className={FILE_INPUT}
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
        <GuardButton leaf="paginas.publicar" className="min-h-10" isLoading={m.isPending} disabled={!text.trim() || m.isPending} onClick={load}>
          Carregar manifest
        </GuardButton>
      </div>
    </section>
  );
}

type PublishCfg = {
  mode?: string; status?: string; liveAt?: string | null; error?: string | null;
  coolifyApp?: string | null; force?: boolean; hasToken?: boolean;
} | undefined;

type TestResult = PostCmsSiteBuilderSupportPublishTest200 | { ok: false; checks: []; error: string };

function PublishSection({ publish, onDone }: { publish: PublishCfg; onDone: () => void }) {
  const [webhook, setWebhook] = useState("");
  const [error, setError] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);

  const saveM = usePutCmsSiteBuilderSupportPublish({
    mutation: {
      onSuccess: (_r, vars) => {
        setError("");
        setWebhook("");
        setTest(null);
        toast.success(vars?.data?.webhookUrl === null ? "Publicação desligada" : "Webhook guardado");
        onDone();
      },
      onError: (e) => setError(errMessage(e, "Não foi possível guardar a publicação.")),
    },
  });
  const testM = usePostCmsSiteBuilderSupportPublishTest({
    mutation: {
      onSuccess: (r) => setTest(r),
      onError: (e) => setTest({ ok: false, checks: [], error: errMessage(e, "Não foi possível testar a ligação.") }),
    },
  });

  const configured = publish?.mode === "coolify" && !!publish.coolifyApp;
  const typed = webhook.trim() !== "";
  const live = publish?.status === "live";
  const status = STATUS_LABEL[configured ? publish?.status ?? "idle" : "idle"] ?? STATUS_LABEL.idle;
  const liveAt = live && publish?.liveAt ? ` · ${new Date(publish.liveAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : "";

  return (
    <section aria-label="Publicação" data-testid="publish-section">
      <SectionTitle right={<Badge tone={status.tone}>{status.label}{liveAt}</Badge>}>Publicação (Coolify)</SectionTitle>
      <p className="text-[13px] text-zinc-500 mb-3">
        Cada gravação nas Páginas publica o site logo a seguir. Cola o webhook de deploy da app do site, tal como o Coolify o
        mostra (Configuração → Webhooks). Só se guardam a app e o «force»; o endereço é sempre o interno da API.
      </p>
      {publish && !publish.hasToken && (
        <p role="alert" data-testid="publish-no-token" className={`${AMBER_BOX} mb-3`}>
          A API não tem o token do Coolify (falta <code>COOLIFY_TOKEN</code> no servidor) — sem ele nada é publicado.
        </p>
      )}
      <div className="space-y-3">
        {configured && (
          <p data-testid="publish-current" className="text-[13px] text-zinc-600 dark:text-zinc-300 break-all">
            App configurada: <code className="font-mono text-[12px]">{publish?.coolifyApp}</code>
            {publish?.force ? " · build sem cache" : ""}
          </p>
        )}
        <Input
          label={configured ? "Trocar o webhook do Coolify" : "Webhook do Coolify"}
          value={webhook}
          maxLength={600}
          onChange={(e: any) => { setWebhook(e.target.value); setError(""); }}
          placeholder="https://coolify…/api/v1/deploy?uuid=…&force=false"
          autoComplete="off"
          spellCheck={false}
          data-testid="publish-webhook"
        />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 break-words">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <GuardButton leaf="paginas.publicar" className="min-h-10" data-testid="publish-save" isLoading={saveM.isPending && typed}
            disabled={saveM.isPending || !typed}
            onClick={() => saveM.mutate({ data: buildPublishBody(webhook) })}>
            Guardar webhook
          </GuardButton>
          <Button variant="outline" className="min-h-10" data-testid="publish-test" isLoading={testM.isPending}
            disabled={testM.isPending || typed || !configured}
            title={typed ? "Guarda o webhook antes de testar." : "Confirma o token, o Coolify e a app — sem fazer deploy."}
            onClick={() => { setTest(null); testM.mutate(); }}>
            Testar
          </Button>
          {configured && (
            <GuardButton leaf="paginas.publicar" variant="ghost" className="min-h-10" data-testid="publish-off" disabled={saveM.isPending}
              onClick={() => saveM.mutate({ data: { webhookUrl: null } })}>
              Desligar
            </GuardButton>
          )}
        </div>
        {test && <TestView result={test} />}
      </div>
    </section>
  );
}

const CHECK_LABEL: Record<string, string> = { token: "Token", health: "Coolify", application: "App do site" };

function TestView({ result }: { result: TestResult }) {
  if ("error" in result) return <p role="alert" className="text-sm text-red-600 dark:text-red-400 break-words">{result.error}</p>;
  return (
    <div role="status" data-testid="publish-test-result" className={result.ok ? "rounded-lg border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : ERROR_BOX}>
      <p className="font-medium">{result.ok ? "Tudo pronto — o site publica ao gravar." : "A ligação não está completa."}</p>
      <ul className="mt-1 space-y-0.5 break-words">
        {result.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span aria-hidden="true" className="shrink-0">{c.ok ? "✓" : "✗"}</span>
            <span><span className="font-medium">{CHECK_LABEL[c.id] ?? c.id}:</span> {c.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
