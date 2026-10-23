import { STATUS_LABELS, STATUS_TONE } from "./constants";
import { fmtEur } from "../../lib/money";
import { Icon } from "../../ui/icons.jsx";
import { Avatar, Badge } from "../../ui/ui.jsx";
import type { ApptEditor } from "./useApptEditor";

/** Cabeçalho do cliente (abre a ficha se houver `onOpenCustomer`). */
export function ApptClientHeader({ ctx }: { ctx: ApptEditor }) {
  const { showMoney, status, isPaid, debtAmount, hasDebt, hasChanges, serviceColor, appt, onOpenCustomer } = ctx;
  const body = (
    <>
      <div className="relative shrink-0">
        <Avatar name={appt.clientName} color={serviceColor} size={44} />
        {hasChanges && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-zinc-900 dark:text-white truncate text-sm ${onOpenCustomer ? "group-hover:text-accent transition-colors" : ""}`}>
          {appt.clientName}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge tone={STATUS_TONE[status] as any} dot>
            {STATUS_LABELS[status]}
          </Badge>
          {showMoney && isPaid && !hasDebt && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Icon name="euro" className="w-3 h-3" /> Pago
            </span>
          )}
          {showMoney && hasDebt && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
              <Icon name="euro" className="w-3 h-3" /> Dívida {fmtEur(debtAmount)}
            </span>
          )}
        </div>
      </div>
    </>
  );
  return onOpenCustomer ? (
    <button
      type="button"
      onClick={onOpenCustomer}
      className="group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 text-left border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition focus:outline-none focus:border-accent/40"
      style={{ borderLeft: `3px solid ${serviceColor}` }}
    >
      {body}
      <Icon
        name="chevronRight"
        className="w-4 h-4 text-zinc-300 group-hover:text-accent transition-colors shrink-0"
      />
    </button>
  ) : (
    <div
      className="flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-xl"
      style={{ borderLeft: `3px solid ${serviceColor}` }}
    >
      {body}
    </div>
  );
}
