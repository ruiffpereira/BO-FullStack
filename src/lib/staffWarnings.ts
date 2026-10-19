import { toast } from "sonner";

/** Avisos não bloqueantes de uma marcação com profissional (`warnings` da resposta do POST/PUT). */
export const STAFF_WARNING_MESSAGE: Record<string, string> = {
  STAFF_BUSY: "Já tem marcação a essa hora.",
  STAFF_TIME_OFF: "Está de férias ou de folga nesse horário.",
};

/** Textos PT dos avisos conhecidos (ignora códigos desconhecidos). */
export function staffWarningMessages(warnings?: readonly string[] | null): string[] {
  return (warnings ?? []).map((w) => STAFF_WARNING_MESSAGE[w]).filter((m): m is string => !!m);
}

/** Um toast âmbar por aviso — a marcação já ficou guardada (sobrepor é permitido no Backoffice, encaixes). */
export function toastStaffWarnings(warnings?: readonly string[] | null) {
  for (const m of staffWarningMessages(warnings)) toast.warning(m, { duration: 6000 });
}
