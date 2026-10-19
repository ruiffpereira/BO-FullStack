import { Select } from "../ui/ui.jsx";
import { Combobox } from "./Combobox";
import { useStaffOptions } from "../hooks/useStaff";
import { staffFilterOptions, staffPickOptions } from "../lib/staffFilter";

/**
 * Selector «Global · Sem profissional · <cada profissional>» dos relatórios (`?staff=`). Não aparece se o tenant
 * não tem profissionais.
 */
export function StaffFilterSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { staff, hasStaff } = useStaffOptions();
  if (!hasStaff) return null;
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
 * tenant não tem profissionais.
 */
export function StaffField({
  label = "Profissional",
  value,
  onChange,
  disabled,
  hint,
  emptyLabel,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  emptyLabel?: string;
}) {
  const { staff, hasStaff } = useStaffOptions();
  if (!hasStaff) return null;
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
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}
