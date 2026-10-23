import { fmtEur } from './money'
/**
 * Fonte única do "estado visual" de uma marcação (cor + label), usada na
 * ficha do cliente (`Clientes.tsx`) e na Agenda (`Agenda.tsx`) — evita ter o
 * mesmo estado (ex.: confirmada) a cores diferentes consoante o ecrã.
 *
 * Esquema:
 *  - confirmada            → azul
 *  - concluída, paga       → verde
 *  - concluída, EM DÍVIDA  → amarelo (dívida = `debt` da API: preço − pago)
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
  /** AG-18: calculada na API; ausente sem `agenda.marcacoes.valores`. */
  debt?: number | null;
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
  /** Dívida em euros (a da API; 0 se não há ou se não se vê o dinheiro). */
  debt: number;
};

const BAR_CLASS: Record<ApptTone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-zinc-300 dark:bg-zinc-600",
};

/**
 * Dívida de uma marcação (AG-18) — vem SEMPRE da API (`debt`, arredondada aos cêntimos, nunca negativa). O Backoffice
 * não calcula dinheiro: sem o campo (membro sem `agenda.marcacoes.valores`, ou resposta antiga) é 0.
 */
export function apptDebt(appt: ApptStatusInput): number {
  const d = Number(appt.debt ?? 0)
  return Number.isFinite(d) && d > 0 ? d : 0
}

export function apptStatusView(appt: ApptStatusInput): ApptStatusView {
  const status = appt.status ?? "pending";
  const debt = apptDebt(appt);

  switch (status) {
    case "confirmed":
      return { key: status, label: "Confirmada", statusLabel: "Confirmada", tone: "blue", barClass: BAR_CLASS.blue, debt };
    case "completed":
      return debt > 0
        ? { key: status, label: `Dívida ${fmtEur(debt)}`, statusLabel: "Concluída", tone: "amber", barClass: BAR_CLASS.amber, debt }
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
