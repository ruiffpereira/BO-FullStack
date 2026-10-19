import { Input } from "../../ui/ui.jsx";
import { useGetMailMailboxes } from "../../gen/backoffice/hooks/useGetMailMailboxes.js";
import { isValidLocalPart } from "../../lib/mail";

/**
 * ☐ «Dar-lhe um endereço de email» (convite e ficha do membro, B42 · fase 6) + a parte local. A parte local sugere-se
 * do nome; só vai à API se o utilizador a escrever (senão a API deriva-a e desambigua). O domínio mostra-se quando a
 * sessão consegue ler a caixa do negócio; a API decide tudo o resto (módulo, caixa do negócio activa, tecto do convidante).
 */
export function GiveMailboxField({
  checked,
  onChecked,
  localPart,
  onLocalPart,
  suggestion,
  grantHint,
  disabled,
}: {
  checked: boolean;
  onChecked: (v: boolean) => void;
  /** O que o utilizador escreveu (vazio = usa a sugestão). */
  localPart: string;
  onLocalPart: (v: string) => void;
  suggestion: string;
  /** Mostra o aviso «dá-lhe também Correio → Caixa» (a caixa sem a folha não se usa). */
  grantHint?: boolean;
  disabled?: boolean;
}) {
  const boxes = useGetMailMailboxes({ query: { enabled: checked, retry: false, staleTime: 60_000 } });
  const business = boxes.data?.mailboxes?.find((m) => m.kind === "business")?.address ?? "";
  const domain = business.includes("@") ? business.split("@")[1] : "";
  const shown = localPart || suggestion;
  const bad = !!localPart && !isValidLocalPart(localPart.toLowerCase());

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3.5 py-3 space-y-3" data-testid="give-mailbox">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-hex,#2A6FDB)]"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChecked(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">Dar-lhe um endereço de email</span>
          <span className="block text-xs text-zinc-500 mt-0.5">
            Uma caixa só dele{domain ? ` (nome@${domain})` : ""}, no Correio e no telemóvel.
          </span>
        </span>
      </label>
      {checked && (
        <>
          <Input
            label="Parte local do endereço"
            value={localPart}
            onChange={(e: any) => onLocalPart(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            placeholder={suggestion || "ana"}
            disabled={disabled}
            autoComplete="off"
            hint={
              bad
                ? "Só letras, números, ponto, hífen e sublinhado."
                : `O endereço fica ${shown || "nome"}@${domain || "o domínio do negócio"}.`
            }
          />
          {grantHint && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Para usar a caixa, dá-lhe também Correio → Caixa nas permissões.
            </p>
          )}
        </>
      )}
    </div>
  );
}
