import { UNLINKED_STAFF_MESSAGE, STAFF_ALL, STAFF_NONE } from "../../../lib/staffFilter";

type StaffOpt = { staffId: string; name: string; color?: string | null; active?: boolean };

/** Filtro por profissional (chips): Todos · Sem profissional · cada um com a sua cor. Só aparece se o tenant tem profissionais. */
export function StaffChips({
  hasStaff,
  onlyMine,
  myStaffId,
  staffList,
  staffSel,
  setStaffSel,
}: {
  hasStaff: boolean;
  onlyMine: boolean;
  myStaffId: string | null | undefined;
  staffList: StaffOpt[];
  staffSel: string;
  setStaffSel: (id: string) => void;
}) {
  return (
    <>
        {hasStaff && (
          <div
            role="group"
            aria-label="Filtrar por profissional"
            data-testid="staff-chips"
            className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 shrink-0 overflow-x-auto"
          >
            {onlyMine && !myStaffId && (
              <span className="text-xs text-zinc-500">{UNLINKED_STAFF_MESSAGE}</span>
            )}
            {(onlyMine
              ? staffList.filter((x) => x.staffId === myStaffId).map((x) => ({ id: x.staffId, label: x.name, color: x.color ?? null }))
              : [
                  { id: STAFF_ALL, label: "Todos", color: null as string | null },
                  { id: STAFF_NONE, label: "Sem profissional", color: null as string | null },
                  ...staffList.filter((x) => x.active).map((x) => ({ id: x.staffId, label: x.name, color: x.color ?? null })),
                ]
            ).map((c) => {
              const on = onlyMine || staffSel === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStaffSel(c.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    on
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
    </>
  );
}
