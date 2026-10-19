import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Toggle } from "../../ui/ui.jsx";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import {
  useGetCustomersCustomeridNewsletter,
  getCustomersCustomeridNewsletterQueryKey,
} from "../../gen/backoffice/hooks/useGetCustomersCustomeridNewsletter.js";
import { usePutCustomersCustomeridNewsletter } from "../../gen/backoffice/hooks/usePutCustomersCustomeridNewsletter.js";
import { CONTACT_SOURCE, mailErrorMessage } from "../../lib/mail";

/**
 * Ficha do cliente → «Aceita novidades por email» (B42 · fase 8). Marcar regista o consentimento ao balcão (origem,
 * data e texto ficam na API); desmarcar retira-o. Folha `clientes.lista.novidades` [Editar]: um membro só-ver vê o
 * estado mas não o muda (o `useWriteGuard` desactiva o interruptor com o motivo). Não exige o módulo Correio.
 * Quem decide se pode ser subscrito (email na ficha, bloqueado) é a API; aqui só se explica.
 */
export function CustomerNewsletterBox({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { readOnly, message } = useWriteGuard("clientes.lista.novidades");
  const q = useGetCustomersCustomeridNewsletter(customerId, { query: { enabled: !!customerId, retry: false } });
  const putM = usePutCustomersCustomeridNewsletter({
    mutation: {
      onSuccess: (res) => {
        toast.success(res?.subscribed ? "Cliente subscrito às novidades." : "Subscrição retirada.");
        qc.invalidateQueries({ queryKey: getCustomersCustomeridNewsletterQueryKey(customerId) });
        // A lista de Contactos muda com isto.
        qc.invalidateQueries({ predicate: (qq) => String((qq.queryKey[0] as { url?: string } | undefined)?.url ?? "").startsWith("/mail") });
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e)),
    },
  });

  const n = q.data;
  if (q.isLoading) return <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" data-testid="newsletter-loading" />;
  if (q.isError || !n) return null;

  const subscribed = !!n.subscribed;
  const noEmail = n.hasEmail === false;
  const blocked = !!n.blocked;
  const disabled = readOnly || putM.isPending || blocked || (noEmail && !subscribed);

  const detail = blocked
    ? "Email bloqueado (inválido ou queixa de spam): não pode receber novidades."
    : noEmail && !subscribed
      ? "O cliente não tem email na ficha."
      : subscribed
        ? [
            n.source ? `Origem: ${CONTACT_SOURCE[n.source] ?? n.source}` : "",
            n.subscribedAt ? `desde ${new Date(n.subscribedAt).toLocaleDateString("pt-PT")}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : n.status === "unsubscribed_by_user"
          ? "Anulou a subscrição. Só marques se o cliente voltar a aceitar."
          : "Marca só se o cliente aceitou receber novidades (ex.: ao balcão).";

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 px-3 py-2.5"
      data-testid="customer-newsletter"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Aceita novidades por email</p>
        <p className="text-xs text-zinc-500" data-testid="customer-newsletter-detail">
          {detail}
        </p>
      </div>
      <span title={readOnly ? message : undefined}>
        <Toggle
          checked={subscribed}
          disabled={disabled}
          label="Aceita novidades por email"
          onChange={(v: boolean) => putM.mutate({ customerId, data: { subscribed: v } })}
        />
      </span>
    </div>
  );
}
