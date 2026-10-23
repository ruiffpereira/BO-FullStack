import { fmtEur } from '../lib/money'
import { useEffect, useState } from "react";
import { Badge } from "../ui/ui.jsx";
import { GuardButton } from "./GuardButton";
import {
  rowsFromRules,
  rulesFromRows,
  validateServiceRows,
  type ServiceLite,
  type ServiceRow,
} from "../lib/staffForm";
import type { StaffServiceRule } from "../gen/backoffice/types/StaffServiceRule.js";

/**
 * «Serviços que faz» + preço próprio por serviço. Todos marcados por omissão (desmarcar = excluído); o preço
 * próprio vazio = o normal e só se edita com `agenda.profissionais.precos` (`canEditPrices`, vem da API) — sem ela o
 * campo aparece só-leitura.
 */
export function StaffServicesEditor({
  services,
  rules,
  canEditPrices,
  saving,
  onSave,
}: {
  services: ServiceLite[];
  rules: StaffServiceRule[] | undefined;
  canEditPrices: boolean;
  saving?: boolean;
  onSave: (rules: StaffServiceRule[]) => void;
}) {
  const [rows, setRows] = useState<ServiceRow[]>(() => rowsFromRules(services, rules));
  const [error, setError] = useState<string | null>(null);

  // Volta a semear quando chegam serviços/regras novas (guardou, ou mudou de profissional).
  const sig = JSON.stringify([services.map((s) => s.serviceId), rules]);
  useEffect(() => {
    setRows(rowsFromRules(services, rules));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const patch = (id: string, p: Partial<ServiceRow>) => setRows((rs) => rs.map((r) => (r.serviceId === id ? { ...r, ...p } : r)));

  const submit = () => {
    const err = validateServiceRows(rows);
    setError(err);
    if (err) return;
    onSave(rulesFromRows(rows));
  };

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Ainda não há serviços. Cria-os em Agenda → Serviços.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Desmarca os serviços que este profissional não faz. O preço próprio, se o preencheres, substitui o normal; vazio = o normal.
      </p>
      {!canEditPrices && (
        <p data-testid="prices-readonly-note" className="text-xs text-zinc-500">
          Não tens permissão para definir preços por profissional — aparecem só para consulta.
        </p>
      )}
      <ul aria-label="Serviços do profissional" className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
        {rows.map((r) => (
          <li key={r.serviceId} className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4" data-service={r.serviceId}>
            <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`Faz ${r.name}`}
                checked={r.does}
                onChange={(e) => patch(r.serviceId, { does: e.target.checked })}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 accent-[var(--accent-hex,#2A6FDB)]"
              />
              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.name}</span>
              {!r.active && <Badge tone="neutral">inactivo</Badge>}
            </label>
            <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
              <span className="text-xs text-zinc-400 whitespace-nowrap">
                {r.price != null ? `normal ${fmtEur(r.price)}` : ""}
              </span>
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Preço próprio em ${r.name}`}
                placeholder="normal"
                value={r.ownPrice}
                readOnly={!canEditPrices}
                disabled={!r.does}
                title={!canEditPrices ? "Precisas da permissão «Preços por profissional»" : undefined}
                onChange={(e) => canEditPrices && patch(r.serviceId, { ownPrice: e.target.value })}
                className="w-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-right tabular-nums text-zinc-900 dark:text-zinc-100 px-2.5 py-1.5 read-only:bg-zinc-50 dark:read-only:bg-zinc-800/50 read-only:text-zinc-500 disabled:opacity-50 focus:outline-none focus:border-accent"
              />
              <span className="text-xs text-zinc-400">€</span>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <GuardButton onClick={submit} isLoading={saving}>
          Guardar serviços
        </GuardButton>
      </div>
    </div>
  );
}
