import { toast } from "sonner";
import type { WorkOp } from "./ops";

/** Id fixo: cada confirmação rápida substitui a anterior em vez de empilhar. */
const QUICK_ID = "paginas-rapido";

/**
 * Confirmação de uma acção rápida do construtor (juntar, duplicar, copiar, esconder, retirar…).
 * Um só toast de cada vez, e curto: vários seguidos empilhavam no canto superior direito e tapavam o
 * botão «Guardar» (e, a 390 px, o cabeçalho). Local ao construtor — o `<Toaster/>` global não muda.
 */
export const quickToast = (message: string): void => {
  toast.success(message, { id: QUICK_ID, duration: 2200 });
};

/** Apagar página (só local até «Guardar») + confirmação: partilhado pela lista e pelas Definições. */
export const deletePageWithToast = (apply: (op: WorkOp) => void, id: string, title: string): void => {
  apply({ type: "deletePage", id });
  quickToast(`«${title}» apagada. Os blocos continuam em Blocos.`);
};
