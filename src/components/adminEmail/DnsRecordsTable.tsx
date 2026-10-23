import { toast } from "sonner";
import { Badge } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import type { EmailDnsRecord } from "../../gen/backoffice/types/EmailDnsRecord.js";

async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copiado`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function CopyCell({ value, what }: { value: string; what: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="font-mono text-xs break-all min-w-0">{value}</span>
      <button
        type="button"
        aria-label={`Copiar ${what}`}
        title={`Copiar ${what}`}
        onClick={() => copyText(value, what.charAt(0).toUpperCase() + what.slice(1))}
        className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Icon name="copy" className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Tabela de registos DNS: o scroll horizontal vive só aqui dentro, nunca na página. `showState=false` para os
 * registos da CAIXA (MX/DKIM do Stalwart): a API não os verifica, só os mostra para copiar.
 */
export function DnsRecordsTable({
  records,
  showState = true,
  testId = "dns-records",
  rowTestId = "dns-record-row",
}: {
  records: EmailDnsRecord[];
  showState?: boolean;
  testId?: string;
  rowTestId?: string;
}) {
  if (records.length === 0)
    return <p className="text-sm text-zinc-500">Sem registos para mostrar.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800" data-testid={testId}>
      <table className={`w-full text-sm ${showState ? "min-w-[34rem]" : "min-w-[28rem]"}`}>
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Valor</th>
            {showState && <th className="px-3 py-2">Estado</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {records.map((r, i) => (
            <tr key={`${r.type}-${r.name}-${i}`} data-testid={rowTestId} className="align-top">
              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                {r.type}
                {r.priority != null && <span className="text-zinc-400"> · {r.priority}</span>}
              </td>
              <td className="px-3 py-2.5 max-w-[12rem]">
                <CopyCell value={r.name ?? ""} what="nome" />
              </td>
              <td className="px-3 py-2.5 max-w-[18rem]">
                <CopyCell value={r.value ?? ""} what="valor" />
              </td>
              {showState && (
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {r.verified ? (
                    <Badge tone="green">✓ Verificado</Badge>
                  ) : (
                    <Badge tone="amber">✗ {r.status && r.status !== "verified" ? r.status : "Em falta"}</Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
