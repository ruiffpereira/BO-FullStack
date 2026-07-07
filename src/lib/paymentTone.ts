/**
 * Estado do valor de pagamento sendo INTRODUZIDO num formulário (ApptModal),
 * comparado com o preço do serviço — decide a cor de um só botão de
 * pagamento (novo + editar) e da linha "Total", coerente nos dois sítios.
 *
 * A comparação usa sempre o total SEM gorjeta (`payNoTip`): é esse valor que
 * decide se a marcação fica em dívida. A gorjeta mostra-se à parte.
 *
 * Esquema (3 tons, sempre os mesmos):
 *  - amber → falta dinheiro (payNoTip < preço)
 *  - blue  → valor certo (payNoTip == preço)
 *  - green → a mais (payNoTip > preço)
 */

export type PaymentTone = "amber" | "blue" | "green";

export type PaymentToneInfo = {
  tone: PaymentTone;
  /** Rótulo curto do estado (ex.: para um badge). */
  label: string;
  /** Frase pronta a mostrar junto ao botão/linha Total, já com o valor. */
  hint: string;
};

/** Dado o total introduzido (sem gorjeta) e o preço-alvo do serviço, devolve
 * o tom + textos para a UI de pagamento. */
export function paymentTone(payNoTip: number, targetPrice: number): PaymentToneInfo {
  const diff = payNoTip - targetPrice;

  if (diff < -0.01) {
    const shortfall = targetPrice - payNoTip;
    return {
      tone: "amber",
      label: "Em dívida",
      hint: `Fica em dívida · faltam ${shortfall.toFixed(2)} €`,
    };
  }

  if (diff > 0.01) {
    return {
      tone: "green",
      label: "A mais",
      hint: `A mais · +${diff.toFixed(2)} €`,
    };
  }

  // |diff| <= 0.01: valor certo. Cobre também o caso-limite de um serviço
  // grátis (preço 0) sem nada introduzido — 0 == 0, não há dívida a saldar.
  return { tone: "blue", label: "Valor certo", hint: "Valor certo" };
}

/** Classes do botão sólido colorido por tom (texto branco, hover mais escuro). */
export const PAYMENT_TONE_BUTTON_CLASS: Record<PaymentTone, string> = {
  amber: "bg-amber-500 hover:bg-amber-600",
  blue: "bg-blue-600 hover:bg-blue-700",
  green: "bg-emerald-600 hover:bg-emerald-700",
};

/** Classes de texto por tom (para a linha "Total", sem fundo). */
export const PAYMENT_TONE_TEXT_CLASS: Record<PaymentTone, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-emerald-600 dark:text-emerald-400",
};
