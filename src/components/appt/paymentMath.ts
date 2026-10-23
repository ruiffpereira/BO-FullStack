// Contas da modal de marcação — puras, sem React (testadas em paymentMath.test.ts).
// A dívida e o estado vêm da API (AG-18); aqui só se somam os campos digitados.

export type PayInputs = { cash: string; mbway: string; card: string; tip: string };
export type PayMethod = "cash" | "mbway" | "card";

/** Campo de texto → número (vazio ou inválido = 0). */
export const toNum = (s: string): number => parseFloat(s) || 0;

/** Gorjeta, total sem gorjeta e total com gorjeta do que está digitado. */
export function paymentTotals(p: PayInputs) {
  const tipVal = toNum(p.tip);
  const payNoTip = toNum(p.cash) + toNum(p.mbway) + toNum(p.card);
  return { tipVal, payNoTip, payTotal: payNoTip + tipVal };
}

/** Método «preenchido com o preço» (um só método com o valor certo), ou null. */
export function activeMethodFor(p: PayInputs, fillPrice: number): PayMethod | null {
  const { payNoTip } = paymentTotals(p);
  if (!(fillPrice > 0 && Math.abs(payNoTip - fillPrice) < 0.01)) return null;
  if (toNum(p.cash) === payNoTip) return "cash";
  if (toNum(p.mbway) === payNoTip) return "mbway";
  if (toNum(p.card) === payNoTip) return "card";
  return null;
}

type SavedPayments = { paymentCash?: number | string | null; paymentMbway?: number | string | null; paymentCard?: number | string | null };

/** O que está digitado difere do que a marcação tem guardado? (a gorjeta soma ao dinheiro) */
export function paymentChangedFrom(saved: SavedPayments, p: PayInputs): boolean {
  const { tipVal } = paymentTotals(p);
  return (
    toNum(p.cash) + tipVal !== Number(saved.paymentCash ?? 0) ||
    toNum(p.mbway) !== Number(saved.paymentMbway ?? 0) ||
    toNum(p.card) !== Number(saved.paymentCard ?? 0)
  );
}

/** Valores a enviar à API: a gorjeta soma ao dinheiro. */
export function paymentPayload(p: PayInputs) {
  const { tipVal } = paymentTotals(p);
  return { paymentCash: toNum(p.cash) + tipVal, paymentMbway: toNum(p.mbway), paymentCard: toNum(p.card) };
}

/**
 * Ao editar os detalhes de uma vaga paga, se o serviço escolhido custa diferente do que já foi pago:
 * positivo = falta cobrar, negativo = a mais, 0 = nada a acertar.
 */
export function priceMismatchFor(opts: {
  isPaid: boolean;
  editingDetails: boolean;
  serviceChanged: boolean;
  editedServicePrice: number;
  totalPaid: number;
}): number {
  return opts.isPaid && opts.editingDetails && opts.serviceChanged ? opts.editedServicePrice - opts.totalPaid : 0;
}

type ApptDetails = { time: string; date: string; serviceId?: string | null; staffId?: string | null };
type DetailEdits = { time: string; date: string; serviceId: string; staffId: string; duration: number };

/** Só os campos que mudaram (detalhes + pagamento), no formato do PUT da marcação. */
export function buildApptSaveData(opts: {
  appt: ApptDetails;
  originalDuration: number;
  edits: DetailEdits;
  pay: PayInputs;
  paymentChanged: boolean;
}): Record<string, unknown> {
  const { appt, originalDuration, edits, pay, paymentChanged } = opts;
  const data: Record<string, unknown> = {};
  if (edits.time !== appt.time) data.time = edits.time;
  if (edits.date !== appt.date) data.date = edits.date;
  if (edits.serviceId !== appt.serviceId) data.serviceId = edits.serviceId;
  if (edits.staffId !== (appt.staffId ?? "")) data.staffId = edits.staffId || null;
  if (edits.duration !== originalDuration) data.duration = edits.duration;
  if (paymentChanged) Object.assign(data, paymentPayload(pay));
  return data;
}
