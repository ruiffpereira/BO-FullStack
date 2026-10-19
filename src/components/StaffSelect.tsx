import { Select } from "../ui/ui.jsx";
import { Combobox } from "./Combobox";
import { useStaffOptions } from "../hooks/useStaff";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { fixedStaff, staffFilterOptions, staffPickOptions, staffPriceHint, UNLINKED_STAFF_MESSAGE } from "../lib/staffFilter";

/**
 * «Só os meus» (âmbito da sessão nas folhas do selector): o selector não oferece Global/Sem profissional/outros,
 * fica fixo no profissional ligado. A API é que filtra de facto; isto só não induz em erro.
 */
function useFixedStaff(leaves: readonly string[] | undefined, staff: Parameters<typeof fixedStaff>[0]) {
  const { scopeOfAll, staffId } = useTeamAccess();
  if (!leaves || leaves.length === 0 || scopeOfAll(leaves) !== "meus") return null;
  return fixedStaff(staff, staffId);
}

/**
 * Selector «Global · Sem profissional · <cada profissional>» dos relatórios (`?staff=`). Não aparece se o tenant
 * não tem profissionais. `leaves` = folhas da árvore a que o selector serve (para o âmbito «Só os meus»).
 */
export function StaffFilterSelect({
  value,
  onChange,
  className = "",
  leaves,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  leaves?: readonly string[];
}) {
  const { staff, hasStaff } = useStaffOptions();
  const fixed = useFixedStaff(leaves, staff);
  if (!hasStaff) return null;
  if (fixed) {
    return (
      <div className={`min-w-[11rem] ${className}`} data-testid="staff-filter-fixed">
        <p className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
          {fixed.linked ? fixed.name : UNLINKED_STAFF_MESSAGE}
        </p>
      </div>
    );
  }
  return (
    <div className={`min-w-[11rem] ${className}`} data-testid="staff-filter">
      <Select aria-label="Profissional" value={value} onChange={(e: any) => onChange(e.target.value)}>
        {staffFilterOptions(staff).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Campo opcional «Profissional» / «Vendido por» de um formulário (marcação, venda, despesa). Não aparece se o
 * tenant não tem profissionais. Com `serviceId` (marcação) vem da API quem faz o serviço e o preço efectivo.
 */
export function StaffField({
  label = "Profissional",
  value,
  onChange,
  disabled,
  hint,
  emptyLabel,
  serviceId,
  leaves,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  emptyLabel?: string;
  serviceId?: string | null;
  leaves?: readonly string[];
}) {
  const { staff, hasStaff } = useStaffOptions(true, serviceId);
  const fixed = useFixedStaff(leaves, staff);
  if (!hasStaff) return null;
  if (fixed) {
    // A API força o profissional ligado ao criar/editar: o campo só o mostra.
    return (
      <div data-testid="staff-field-fixed">
        <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>
        <p className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
          {fixed.linked ? fixed.name : UNLINKED_STAFF_MESSAGE}
        </p>
      </div>
    );
  }
  const priceHint = serviceId ? staffPriceHint(staff, value) : null;
  const shownHint = hint ?? priceHint;
  return (
    <div data-testid="staff-field">
      <Combobox
        label={label}
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={staffPickOptions(staff, value, emptyLabel)}
        placeholder={emptyLabel ?? "Sem profissional"}
        searchPlaceholder="Pesquisar profissional…"
        disabled={disabled}
      />
      {shownHint && <p className="text-xs text-zinc-400 mt-1">{shownHint}</p>}
    </div>
  );
}
