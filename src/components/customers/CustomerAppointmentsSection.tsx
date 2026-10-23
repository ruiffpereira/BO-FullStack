import { fmtEur } from "../../lib/money";
import { apptStatusView } from "../../lib/apptStatus";
import { Icon } from "../../ui/icons.jsx";
import { Badge } from "../../ui/ui.jsx";
import type { GetCustomersIdHistory200 } from "../../gen/backoffice/types/GetCustomersIdHistory.js";
import type { Appointment } from "../../gen/backoffice/types/Appointment.js";
import { paidAmountToShow } from "./customerAccess";

/**
 * Estatísticas + dívida + histórico de marcações do cliente. Sem `agenda.marcacoes.valores` (`showMoney` falso) a API
 * não envia dinheiro e aqui não se desenha nenhuma caixa/valor (nunca «0 €»). A dívida total vem da API (AG-18).
 */
export function CustomerAppointmentsSection({
  history,
  isLoading,
  showMoney,
  onOpenAppointment,
}: {
  history: GetCustomersIdHistory200 | undefined;
  isLoading: boolean;
  showMoney: boolean;
  onOpenAppointment: (appt: Appointment) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }
  if (!history) return null;

  const favoriteService = history.appointments.find(
    (a) => a.service && a.serviceId === history.stats.favoriteServiceId,
  )?.service;
  const showSpent = showMoney && history.stats.totalSpent != null;
  const totalDebt = showMoney ? (history.stats.debt ?? 0) : 0;
  const appointments = history.appointments;

  return (
    <>
      <div className={`grid gap-3 ${showSpent ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{history.stats.visitCount}</p>
          <p className="text-xs text-zinc-400 mt-0.5">visitas</p>
        </div>
        {showSpent && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtEur(history.stats.totalSpent ?? 0)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">gasto total</p>
          </div>
        )}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">{favoriteService?.name ?? "—"}</p>
          <p className="text-xs text-zinc-400 mt-0.5">serviço favorito</p>
        </div>
      </div>
      {history.stats.lastVisit && (
        <p className="text-xs text-zinc-400 text-center -mt-1">
          Última visita: {new Date(history.stats.lastVisit + "T00:00:00").toLocaleDateString("pt-PT", { dateStyle: "long" })}
        </p>
      )}

      {/* Aviso de dívida — total calculado na API (AG-18), nunca somado aqui. */}
      {totalDebt > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/60 px-3 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <Icon name="alertCircle" className="w-4 h-4 shrink-0" />
          <span>Este cliente tem {fmtEur(totalDebt)} em dívida.</span>
        </div>
      )}

      {appointments.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Histórico de marcações</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {appointments.map((a) => {
              const paid = paidAmountToShow(a, showMoney);
              const view = apptStatusView(a);
              return (
                <button
                  key={a.appointmentId}
                  onClick={() => onOpenAppointment(a as unknown as Appointment)}
                  className="w-full flex items-center gap-3 p-2.5 pl-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                >
                  <span className={`w-1 self-stretch rounded-full shrink-0 ${view.barClass}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">{a.date} · {a.time}</p>
                    <p className="text-xs text-zinc-400 truncate">{a.service?.name ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={view.tone}>{view.label}</Badge>
                    {paid != null && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{fmtEur(paid)}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400 text-center py-2">Sem marcações registadas para este cliente.</p>
      )}
    </>
  );
}
