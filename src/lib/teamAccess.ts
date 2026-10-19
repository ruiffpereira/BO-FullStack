import { toast } from "sonner";
import { STAFF_MESSAGE_BY_CODE } from "./apiError";
import { mailCodeMessage } from "./mail";

/**
 * Equipa do tenant (B41) — peças puras do lado do Backoffice. A decisão de quem pode o quê é SEMPRE da API
 * (`GET /userpermissions/access`); aqui só há textos, o feedback reactivo dos 403 e o mapa pathname → módulo.
 */

/** Motivo único (PT) dos CTAs de escrita desactivados a um membro que só tem `view` no módulo da página. */
export const VIEW_ONLY_MESSAGE = "Só tens permissão para ver";
/** 403 `TEAM_OWNER_DISABLED`: o dono desactivou o membro; só ele o reactiva. */
export const OWNER_DISABLED_MESSAGE = "Foi o dono que desactivou este utilizador.";
/** 403 `TEAM_OWNER_ONLY`: área que nunca é delegável (faturação, perfil do negócio, …). */
export const OWNER_ONLY_MESSAGE = "Esta área é só do dono da conta";

const TOAST_ID = "team-403";
const THROTTLE_MS = 5_000;
let lastShownAt = 0;

/**
 * Feedback reactivo, no molde de `billing402.ts`: um toast coalescido quando a API recusa por permissões da
 * equipa (`TEAM_FORBIDDEN` ao escrever com `view` / fora dos módulos; `TEAM_OWNER_ONLY`). Não engole o erro.
 */
export function notifyTeamForbidden(status: number | undefined, data: unknown): boolean {
  if (status !== 403) return false;
  const code = (data as { code?: unknown } | null | undefined)?.code;
  if (code !== "TEAM_FORBIDDEN" && code !== "TEAM_OWNER_ONLY") return false;
  const now = Date.now();
  if (now - lastShownAt < THROTTLE_MS) return true;
  lastShownAt = now;
  toast.error(code === "TEAM_OWNER_ONLY" ? OWNER_ONLY_MESSAGE : VIEW_ONLY_MESSAGE, { id: TOAST_ID });
  return true;
}

/** Reset do throttle — só para testes. */
export function resetTeamForbiddenThrottle() {
  lastShownAt = 0;
}

export type TeamMemberStatus = "invited" | "active" | "disabled";

export const MEMBER_STATUS_LABEL: Record<TeamMemberStatus, string> = {
  invited: "Convidado",
  active: "Activo",
  disabled: "Desactivado",
};

export const MEMBER_STATUS_TONE: Record<TeamMemberStatus, "blue" | "green" | "neutral"> = {
  invited: "blue",
  active: "green",
  disabled: "neutral",
};

/** Mensagem PT para os erros de `/team*` (códigos da API). */
export function teamErrorMessage(error: unknown, fallback: string): string {
  const data = (error as any)?.response?.data;
  // Profissionais (R2): ligar/desligar um membro, âmbito «Só os meus».
  if (typeof data?.code === "string" && STAFF_MESSAGE_BY_CODE[data.code]) return STAFF_MESSAGE_BY_CODE[data.code];
  switch (data?.code) {
    case "EMAIL_IN_USE":
      return "Este email já está a ser usado por outra conta ou membro.";
    case "TEAM_LIMIT":
      return "Atingiste o número máximo de membros da equipa.";
    case "TEAM_GRANT_NOT_ALLOWED":
      return "Há permissões (ou um âmbito «Todos») que não podes dar.";
    case "TEAM_DELEGATE_LIMIT":
      return "Este membro já tem 20 utilizadores convidados — é o máximo por membro.";
    case "TEAM_OWNER_DISABLED":
      return OWNER_DISABLED_MESSAGE;
    case "TEAM_ADMIN_FORBIDDEN":
      return "A conta de administrador não tem equipa.";
    case "TEAM_OWNER_ONLY":
      return OWNER_ONLY_MESSAGE + ".";
    case "IMPERSONATION_FORBIDDEN":
      return "Esta acção não está disponível numa sessão de suporte.";
  }
  if ((error as any)?.response?.status === 429) {
    return "Foram enviados demasiados convites a partir desta conta. Tenta de novo daqui a uma hora.";
  }
  // Correio (B42): pedir uma caixa no convite pode falhar antes de criar o membro (módulo, caixa do negócio, endereço).
  const mail = mailCodeMessage(data?.error) ?? mailCodeMessage(data?.code);
  if (mail) return mail;
  if (typeof data?.error === "string" && data.error) return data.error;
  if (typeof data?.message === "string" && data.message) return data.message;
  return fallback;
}

/** `mailboxError` de POST/PUT /team: o membro/convite foi criado mas o endereço de email não (código da API → PT). */
export function mailboxErrorMessage(code: unknown): string {
  return mailCodeMessage(code) ?? "Não foi possível criar o endereço de email. Podes tentar de novo na ficha do membro.";
}
