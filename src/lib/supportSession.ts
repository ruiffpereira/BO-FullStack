import { toast } from "sonner";
import { getApiError } from "./apiError";

/**
 * Sessão de suporte ("Acesso de suporte", DECISOES 2026-10-10): o admin da
 * plataforma entra na conta de um tenant, sem password, durante o tempo que o
 * tenant consentiu. Este módulo só tem as peças puras/sem estado; a máquina de
 * estados vive no `AuthContext`.
 *
 * Armazenamento: `sessionStorage` (POR SEPARADOR). Nunca `localStorage` — o
 * `localStorage` é partilhado por todos os separadores, e os separadores do
 * admin herdavam a sessão do cliente.
 */

export const SUPPORT_SESSION_STORAGE_KEY = "backoffice.supportSession";

/** Nota única para tudo o que fica desactivado numa sessão de suporte. */
export const SUPPORT_UNAVAILABLE_NOTE = "Indisponível numa sessão de suporte";

export interface SupportTenant {
  userId: string;
  name: string;
  email: string;
}

export interface StoredSupportSession {
  accessToken: string;
  expiresAt: string;
  tenant: SupportTenant;
}

/** O que a UI vê (nunca o token). */
export interface SupportSessionInfo {
  tenantName: string;
  expiresAt: string;
}

export type SupportEndReason = "expired" | "ended" | "exit";

export type StoredSupportResult =
  | { status: "none" }
  | { status: "expired" }
  | { status: "valid"; session: StoredSupportSession };

/**
 * Lê a sessão de suporte do separador. Pura (não remove nada): quem decide
 * limpar é o chamador — assim é seguro chamá-la em render/inicializadores.
 */
export function readSupportSession(now = Date.now()): StoredSupportResult {
  if (typeof window === "undefined") return { status: "none" };
  try {
    const raw = window.sessionStorage.getItem(SUPPORT_SESSION_STORAGE_KEY);
    if (!raw) return { status: "none" };
    const p = JSON.parse(raw) as Partial<StoredSupportSession> | null;
    const t = p?.tenant;
    if (
      !p ||
      typeof p.accessToken !== "string" ||
      !p.accessToken ||
      typeof p.expiresAt !== "string" ||
      !t ||
      typeof t.userId !== "string" ||
      typeof t.name !== "string" ||
      typeof t.email !== "string"
    ) {
      return { status: "none" };
    }
    const exp = new Date(p.expiresAt).getTime();
    if (Number.isNaN(exp)) return { status: "none" };
    if (exp <= now) return { status: "expired" };
    return {
      status: "valid",
      session: {
        accessToken: p.accessToken,
        expiresAt: p.expiresAt,
        tenant: { userId: t.userId, name: t.name, email: t.email },
      },
    };
  } catch {
    return { status: "none" };
  }
}

export function writeSupportSession(session: StoredSupportSession): void {
  try {
    window.sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage indisponível — a sessão fica só em memória (um reload termina-a).
  }
}

export function clearSupportSession(): void {
  try {
    window.sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Erros da API ────────────────────────────────────────────────────────────

export function apiErrorCode(error: unknown): string | undefined {
  const code = (error as any)?.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

/** 403 `IMPERSONATION_FORBIDDEN`: a API recusa esta acção numa sessão de suporte. */
export function isImpersonationForbiddenError(status: number | undefined, data: unknown): boolean {
  return status === 403 && (data as any)?.code === "IMPERSONATION_FORBIDDEN";
}

const FORBIDDEN_TOAST_ID = "impersonation-403";
const THROTTLE_MS = 5_000;
let lastShownAt = 0;

/**
 * Feedback reactivo, no mesmo molde de `billing402.ts`: um toast coalescido
 * quando uma acção que a API proíbe em sessão de suporte escapa à UI. Não
 * engole o erro (o interceptor continua a rejeitar a promise).
 */
export function notifyImpersonationForbidden(status: number | undefined, data: unknown): boolean {
  if (!isImpersonationForbiddenError(status, data)) return false;
  const now = Date.now();
  if (now - lastShownAt < THROTTLE_MS) return true;
  lastShownAt = now;
  toast.error("Esta acção não está disponível numa sessão de suporte.", { id: FORBIDDEN_TOAST_ID });
  return true;
}

/** Reset do throttle — só para testes. */
export function resetImpersonationForbiddenThrottle() {
  lastShownAt = 0;
}

/** Mensagem PT para o erro do `POST /admin/users/:userId/impersonate`. */
export function supportEntryErrorMessage(error: unknown): string {
  const status = (error as any)?.response?.status as number | undefined;
  switch (apiErrorCode(error)) {
    case "TARGET_IS_ADMIN":
      return "Esta é uma conta de administrador — não é possível entrar nela.";
    case "SUPPORT_ACCESS_DENIED":
      return "O cliente não autorizou o acesso. Pede-lhe para o dar no Perfil.";
    case "IMPERSONATION_FORBIDDEN":
      return "Não podes iniciar uma sessão de suporte a partir de outra sessão de suporte.";
  }
  if (status === 400) return "Não podes entrar na tua própria conta.";
  if (status === 404) return "Utilizador não encontrado.";
  return getApiError(error, "Não foi possível iniciar a sessão de suporte.");
}

export const SUPPORT_END_MESSAGES: Record<SupportEndReason, string> = {
  expired: "O tempo da sessão de suporte esgotou-se.",
  ended: "O cliente revogou o acesso, ou a sessão foi terminada pelo servidor.",
  exit: "Saíste da conta do cliente.",
};
