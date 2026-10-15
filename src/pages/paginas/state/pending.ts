/**
 * Upload diferido do construtor (regra do repo: escolher um ficheiro NUNCA envia).
 *
 * Um `media` escolhido guarda no valor um marcador local — o URL `blob:` do preview — e o `File` fica
 * aqui, num registo em memória FORA do estado serializável (o desfazer faz `JSON.stringify`). No
 * "Guardar", `uploadPending` envia os que ainda estão no trabalho e devolve-o com os URLs reais; um
 * `blob:` nunca chega à API. Falha de um envio ⇒ lança e o Guardar pára sem gravar nada.
 *
 * O registo guarda também o URL já enviado: se o `save` falhar depois dos envios (409/422/rede) ou se
 * se desfizer para um estado com o marcador, não se envia o mesmo ficheiro duas vezes.
 */
import { uploadImage } from "../../../gen/backoffice/hooks/useUploadImage.js";
import { uploadPdf } from "../../../gen/backoffice/hooks/useUploadPdf.js";
import { uploadVideo } from "../../../gen/backoffice/hooks/useUploadVideo.js";
import { newShortId } from "./ids";
import type { Work } from "./types";

export type MediaKind = "image" | "file" | "video";

export interface PendingEntry {
  file: File;
  kind: MediaKind;
  /** URL real, depois de enviado (o marcador pode continuar em fotografias do desfazer). */
  uploaded?: string;
}

/** Pasta de destino no storage (a mesma dos CMS). */
export const UPLOAD_MODULE = "cms";

const registry = new Map<string, PendingEntry>();

export const isPendingUrl = (v: unknown): v is string => typeof v === "string" && v.startsWith("blob:");
export const pendingEntry = (url: unknown): PendingEntry | undefined => (typeof url === "string" ? registry.get(url) : undefined);

/** Guarda o ficheiro e devolve o marcador (`blob:`) que vai para o valor do campo. */
export function registerPending(file: File, kind: MediaKind): string {
  const url =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : `blob:local/${newShortId(16)}`;
  registry.set(url, { file, kind });
  return url;
}

/** Só para testes. */
export function clearPending(): void {
  registry.clear();
}

// ── varrimento do trabalho ────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Marcadores registados que ainda estão no trabalho, sem repetidos, pela ordem em que aparecem. */
export function collectPending(work: Work): string[] {
  const found = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      if (registry.has(v)) found.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v)) Object.values(v).forEach(walk);
  };
  walk(work);
  return [...found];
}

/** Há media por carregar? */
export const hasPending = (work: Work): boolean => collectPending(work).length > 0;

/** Troca cada marcador por `map[marcador]` em todo o valor (cópia; o resto fica por referência). */
export function replaceUrls<T>(v: T, map: Readonly<Record<string, string>>): T {
  if (typeof v === "string") return (map[v] ?? v) as T;
  if (Array.isArray(v)) {
    let changed = false;
    const out = v.map((x) => {
      const r = replaceUrls(x, map);
      if (r !== x) changed = true;
      return r;
    });
    return (changed ? out : v) as T;
  }
  if (isObj(v)) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const r = replaceUrls(x, map);
      if (r !== x) changed = true;
      out[k] = r;
    }
    return (changed ? out : v) as T;
  }
  return v;
}

// ── envio ─────────────────────────────────────────────────────────────────────

export type Uploader = (file: File, kind: MediaKind) => Promise<string>;

/** `/api/uploads` (imagem) · `/api/uploads/video` · `/api/uploads/pdf` (`kind: file`). */
export const defaultUploader: Uploader = async (file, kind) => {
  if (kind === "image") return (await uploadImage({ image: file, module: UPLOAD_MODULE })).fileUrl;
  if (kind === "video") return (await uploadVideo({ file, module: UPLOAD_MODULE })).fileUrl;
  return (await uploadPdf({ file })).fileUrl;
};

export class PendingUploadError extends Error {
  constructor(public fileName: string, public reason: string) {
    super(`Não foi possível carregar «${fileName}»: ${reason}`);
    this.name = "PendingUploadError";
  }
}

const reasonOf = (err: unknown): string => {
  const e = err as { response?: { data?: { error?: unknown; message?: unknown } }; message?: string } | null;
  const d = e?.response?.data;
  const msg = typeof d?.error === "string" ? d.error : typeof d?.message === "string" ? d.message : e?.message;
  return msg || "falha no envio";
};

/**
 * Envia os ficheiros pendentes (um de cada vez; o mesmo marcador conta uma só vez) e devolve o
 * trabalho sem marcadores + o mapa `marcador → URL`. Lança `PendingUploadError` ao primeiro que falhar:
 * o que já subiu fica registado, mas nada é devolvido — o chamador não grava.
 */
export async function uploadPending(
  work: Work,
  upload: Uploader = defaultUploader,
): Promise<{ work: Work; map: Record<string, string> }> {
  const map: Record<string, string> = {};
  for (const url of collectPending(work)) {
    const entry = registry.get(url)!;
    if (!entry.uploaded) {
      try {
        entry.uploaded = await upload(entry.file, entry.kind);
      } catch (err) {
        throw new PendingUploadError(entry.file.name, reasonOf(err));
      }
    }
    map[url] = entry.uploaded;
  }
  return Object.keys(map).length ? { work: replaceUrls(work, map), map } : { work, map };
}
