import { PAYMENT_TONE_BUTTON_CLASS, type PaymentTone } from "../../lib/paymentTone";

/**
 * Botão de pagamento ÚNICO — o mesmo aspeto no fluxo de novo pagamento e no
 * de editar pagamento (só muda o `onClick`/label conforme o fluxo que o usa).
 * Cor por tom (amarelo/azul/verde, ver `src/lib/paymentTone.ts`); desativado
 * mostra o motivo via `title` (o `disabled:pointer-events-none` do próprio
 * botão trata do hover).
 */
export function PaymentButton({
  label,
  tone,
  disabled,
  title,
  onClick,
  className = "",
}: {
  label: string;
  tone: PaymentTone;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={onClick}
      className={`rounded-lg py-2.5 px-4 text-sm font-bold text-white transition disabled:opacity-50 disabled:pointer-events-none ${PAYMENT_TONE_BUTTON_CLASS[tone]} ${className}`}
    >
      {label}
    </button>
  );
}
