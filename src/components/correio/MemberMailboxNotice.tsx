import { useEffect, useState } from "react";
import { useGetTeamMailboxPreview } from "../../gen/backoffice/hooks/useGetTeamMailboxPreview.js";

/**
 * Convite de membro (B55, CR-09): a caixa de correio do membro cria-se SOZINHA ao convidá-lo — já não se pede nem se escolhe o endereço.
 * Mostra o endereço que vai ser criado (a previsão vem da API: `GET /team/mailbox-preview`, o BO não o calcula) e o que ele abre.
 */
export function MemberMailboxNotice({ name, disabled }: { name: string; disabled?: boolean }) {
  // Pequeno atraso para não perguntar à API a cada letra.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(name.trim()), 350);
    return () => clearTimeout(t);
  }, [name]);
  const q = useGetTeamMailboxPreview({ name: debounced }, { query: { enabled: !disabled && debounced.length > 0, retry: false, staleTime: 30_000 } });
  const address = debounced ? (q.data?.address ?? null) : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3.5 py-3 space-y-1" data-testid="member-mailbox-notice">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Endereço de email</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {address ? (
          <>
            Vai receber a caixa <span className="font-mono text-xs break-all" data-testid="member-mailbox-preview">{address}</span>, só dele.
          </>
        ) : (
          "Vai receber uma caixa de correio só dele, criada sozinha ao enviar o convite."
        )}
      </p>
      <p className="text-xs text-zinc-500">A caixa pessoal funciona sempre. A caixa do negócio (suporte) só se lhe deres Correio → Caixa.</p>
    </div>
  );
}
