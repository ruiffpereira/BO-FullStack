/**
 * Fonte única do "estado visual" de uma marcação (cor + label), usada na
 * ficha do cliente (`Clientes.tsx`) e na Agenda (`Agenda.tsx`) — evita ter o
 * mesmo estado (ex.: confirmada) a cores diferentes consoante o ecrã.
 *
 * Esquema:
 *  - confirmada            → azul
 *  - concluída, paga       → verde
 *  - concluída, EM DÍVIDA  → amarelo (dívida = preço do serviço − total pago)
 *  - cancelada             → vermelho
 *  - pendente              → âmbar
 *  - faltou (`no_show`)    → neutro ("Faltou"; não faz parte do enum gerado
 *    pelo Kubb — a API pode devolver a string na mesma)
 */

export type ApptTone = "neutral" | "blue" | "green" | "amber" | "red";

/** O mínimo que a função lê de uma marcação — encaixa tanto no `Appointment`
 * gerado pelo Kubb como nas variantes `HistoryAppt` locais (Clientes/Agenda). */
export type ApptStatusInput = {
  status?: string | null;
  paymentCash?: number | null;
  paymentMbway?: number | null;
  paymentCard?: number | null;
  servicePrice?: number | null;
  service?: { price?: number | null } | null;
};

export type ApptStatusView = {
  /** O `status` normalizado (nunca null/undefined; default `"pending"`). */
  key: string;
  /** Label PT pronto a mostrar (já inclui o valor em dívida quando aplicável). */
  label: string;
  /** Label PT do estado puro (sem dívida) — ex.: "Concluída"/"Faltou". Para
   * ecrãs que já têm uma coluna/indicador de dívida separado (ex.: tabela
   * Marcações da Agenda) e não querem duplicar o valor no badge de estado. */
  statusLabel: string;
  tone: ApptTone;
  /** Classe Tailwind para uma barra/indicador de cor sólida (consistente com o tom do Badge). */
  barClass: string;
  /** Dívida em euros (0 se não concluída ou já paga). */
  debt: number;
};

const BAR_CLASS: Record<ApptTone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-zinc-300 dark:bg-zinc-600",
};

/** Dívida de uma marcação: preço do serviço − (dinheiro+MBway+cartão), nunca negativa; 0 se não estiver concluída.
 * Arredondada aos cêntimos ANTES do clamp/comparação — pagamentos repartidos por 2-3 métodos
 * (ex.: 0.29+0.29+0.29 contra um preço de 0.87) deixam um resíduo de vírgula flutuante
 * (~1e-16) que, sem arredondar, passava `debt > 0` e mostrava uma marcação totalmente paga
 * como "em dívida". */
export function apptDebt(appt: ApptStatusInput): number {
  if ((appt.status ?? "pending") !== "completed") return 0;
  const paid =
    Number(appt.paymentCash || 0) +
    Number(appt.paymentMbway || 0) +
    Number(appt.paymentCard || 0);
  const price = Number(appt.servicePrice ?? appt.service?.price ?? 0);
  const rounded = Math.round((price - paid) * 100) / 100;
  return Math.max(0, rounded);
}

export function apptStatusView(appt: ApptStatusInput): ApptStatusView {
  const status = appt.status ?? "pending";
  const debt = apptDebt(appt);

  switch (status) {
    case "confirmed":
      return { key: status, label: "Confirmada", statusLabel: "Confirmada", tone: "blue", barClass: BAR_CLASS.blue, debt };
    case "completed":
      return debt > 0
        ? { key: status, label: `Dívida ${debt.toFixed(2)} €`, statusLabel: "Concluída", tone: "amber", barClass: BAR_CLASS.amber, debt }
        : { key: status, label: "Concluída", statusLabel: "Concluída", tone: "green", barClass: BAR_CLASS.green, debt };
    case "cancelled":
      return { key: status, label: "Cancelada", statusLabel: "Cancelada", tone: "red", barClass: BAR_CLASS.red, debt };
    case "pending":
      return { key: status, label: "Pendente", statusLabel: "Pendente", tone: "amber", barClass: BAR_CLASS.amber, debt };
    case "no_show":
      return { key: status, label: "Faltou", statusLabel: "Faltou", tone: "neutral", barClass: BAR_CLASS.neutral, debt };
    default:
      return { key: status, label: status, statusLabel: status, tone: "neutral", barClass: BAR_CLASS.neutral, debt };
  }
}
