import { useGetCmsSiteBuilder, getCmsSiteBuilderQueryKey } from "../gen/backoffice/hooks/useGetCmsSiteBuilder.js";
import { usePostCmsSiteBuilderSave } from "../gen/backoffice/hooks/usePostCmsSiteBuilderSave.js";
import { usePostCmsSiteBuilderPublish } from "../gen/backoffice/hooks/usePostCmsSiteBuilderPublish.js";
import type { GetCmsSiteBuilder200 } from "../gen/backoffice/types/GetCmsSiteBuilder";

/**
 * Construtor de páginas (CONTRATO §5) — envolve os hooks gerados pelo Kubb:
 * `GET /cms/site-builder`, `POST /cms/site-builder/save` e `POST /cms/site-builder/publish`.
 * Sem tipos escritos à mão: tudo vem de `src/gen/`.
 */

export { getCmsSiteBuilderQueryKey as siteBuilderQueryKey };

/** Enquanto o site está a publicar, volta a perguntar de tempos a tempos (o resto do estado é do editor). */
export const POLL_MS = 5_000;

/** `pending`/`running` → volta a perguntar; qualquer outro estado (ou sem dados) → pára. */
export function publishRefetchInterval(data: unknown): number | false {
  const s = (data as GetCmsSiteBuilder200 | undefined)?.publish?.status;
  return s === "pending" || s === "running" ? POLL_MS : false;
}

/**
 * O estado inteiro do tenant. Sem refetch ao voltar à janela: a cópia de trabalho NUNCA é
 * substituída por um refetch (só pelo "Recarregar"); isto serve o carregamento inicial e o estado
 * da publicação.
 */
export function useSiteBuilderQuery() {
  return useGetCmsSiteBuilder({
    query: {
      refetchOnWindowFocus: false,
      staleTime: 0,
      refetchInterval: (query: { state: { data?: unknown } }) => publishRefetchInterval(query.state.data),
    },
  });
}

export const useSaveSiteBuilder = () => usePostCmsSiteBuilderSave({});
export const usePublishSiteBuilder = () => usePostCmsSiteBuilderPublish({});

export interface ApiFailure {
  status: number | null;
  /** `REVISION_CONFLICT`, `PAGE_IN_USE`, `VALIDATION`, `TOO_SOON`… */
  code?: string;
  /** Corpo da resposta de erro (issues, refs, pages…). */
  data: Record<string, unknown>;
  message: string;
}

/** Normaliza um erro de axios (o cliente gerado lança-o tal como veio). */
export function readApiFailure(err: unknown): ApiFailure {
  const e = err as { response?: { status?: number; data?: unknown }; message?: string } | null;
  const raw = e?.response?.data;
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const msg = typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : e?.message;
  return {
    status: typeof e?.response?.status === "number" ? e.response.status : null,
    code: typeof data.code === "string" ? data.code : undefined,
    data,
    message: msg || "Não foi possível concluir o pedido.",
  };
}

/** "Publicar agora" (CONTRATO §5.3/§11): a resposta da API em linguagem de cliente. */
export function publishErrorMessage(f: ApiFailure): string {
  if (f.status === 409 && f.code === "PUBLISH_NOT_COOLIFY") return "Este site publica sozinho ao guardar — não há nada para publicar à mão.";
  if (f.status === 409 && f.code === "PUBLISH_NOT_CONFIGURED") return "A publicação ainda não está configurada para este site. Fala com a equipa.";
  if (f.status === 409 && f.code === "PUBLISH_IN_PROGRESS") return "Já há uma publicação a decorrer. Aguarda que termine.";
  if (f.status === 429 || f.code === "TOO_SOON") return "Acabaste de publicar. Espera um minuto antes de tentar de novo.";
  if (f.status === 502 || f.code === "DISPATCH_FAILED") return "Não foi possível pedir a publicação ao site. Tenta de novo dentro de instantes.";
  return f.message;
}
