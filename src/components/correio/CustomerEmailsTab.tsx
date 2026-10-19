import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../ui/ui.jsx";
import { useGetMailByCustomerCustomerid } from "../../gen/backoffice/hooks/useGetMailByCustomerCustomerid.js";
import { isMailNotConfigured, mailErrorMessage, mailThreadHref } from "../../lib/mail";
import { MailThreadRow, MailPager } from "./MailThreadList";

const LIMIT = 10;

/**
 * Separador «Emails» da ficha do cliente (B42 · fase 6): as conversas da caixa DO NEGÓCIO com o email deste cliente
 * (correspondência exacta, feita na API). Abrir uma leva à Caixa nessa conversa. Só se monta com `correio.caixa` (Ver)
 * e `clientes.lista` (Ver) — a API recusa o resto.
 */
export function CustomerEmailsTab({ customerId, onOpen }: { customerId: string; onOpen?: () => void }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useGetMailByCustomerCustomerid(customerId, { page, limit: LIMIT }, { query: { retry: false } });
  const items = q.data?.items ?? [];
  const mailboxId = q.data?.mailboxId ?? null;

  if (q.isLoading) return <div className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (isMailNotConfigured(q.error) || q.data?.configured === false) {
    return (
      <p data-testid="customer-emails-not-configured" className="text-sm text-zinc-500">
        Por configurar — o correio ainda não está ligado neste servidor.
      </p>
    );
  }
  if (q.isError) {
    return (
      <div className="space-y-2 text-sm text-red-600 dark:text-red-400">
        <p>{mailErrorMessage(q.error, "Não foi possível carregar os emails.")}</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!mailboxId) {
    return (
      <p data-testid="customer-emails-no-mailbox" className="text-sm text-zinc-500">
        O negócio ainda não tem uma caixa de correio activa.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p data-testid="customer-emails-empty" className="text-sm text-zinc-500">
        Ainda não há conversas por email com este cliente.
      </p>
    );
  }
  return (
    <div data-testid="customer-emails" className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
      <ul>
        {items.map((it) => (
          <MailThreadRow
            key={it.threadId}
            item={it}
            folder="all"
            onSelect={() => {
              if (!it.threadId) return;
              onOpen?.();
              navigate(mailThreadHref(mailboxId, it.threadId));
            }}
          />
        ))}
      </ul>
      <MailPager page={page} limit={LIMIT} total={q.data?.total ?? 0} onPage={setPage} />
    </div>
  );
}
