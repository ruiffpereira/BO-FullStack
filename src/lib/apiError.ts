import { mailCodeMessage } from "./mail";

/** Códigos dos Profissionais (R2): mensagens PT partilhadas com `teamErrorMessage` (lib/teamAccess.ts). */
export const STAFF_MESSAGE_BY_CODE: Record<string, string> = {
  STAFF_HAS_HISTORY: "Tem histórico — desactiva-o em vez de apagar.",
  STAFF_LINK_FORBIDDEN: "Com o âmbito «Só os meus» não podes ligar membros a profissionais.",
  STAFF_NOT_FOUND: "Esse profissional já não existe.",
  STAFF_INVALID: "Profissional inválido.",
  STAFF_MEMBER_TAKEN: "Esse membro já está ligado a outro profissional.",
  STAFF_SCOPE_NO_STAFF: "Ainda não estás ligado a nenhum profissional — pede ao dono para te ligar a um.",
};

/** Mensagem PT para códigos da API cujo texto cru é técnico (ex.: fala em `contentKey`). */
const MESSAGE_BY_CODE: Record<string, string> = {
  CONTENT_KEY_TAKEN: "Já existe outro com este nome. Escolhe ou escreve outro nome.",
  CATEGORY_REQUIRED: "Escolhe a categoria.",
  OUT_OF_STOCK: "Produto esgotado.",
  ...STAFF_MESSAGE_BY_CODE,
};

export function getApiError(error: unknown, fallback = "Ocorreu um erro"): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as any).response?.data;
    if (typeof data?.code === "string" && MESSAGE_BY_CODE[data.code]) return MESSAGE_BY_CODE[data.code];
    const mail = mailCodeMessage(data?.code);
    if (mail) return mail;
    if (typeof data?.error === "string" && data.error) return data.error;
    if (typeof data?.message === "string" && data.message) return data.message;
  }
  return fallback;
}
