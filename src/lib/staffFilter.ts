/**
 * Profissionais (R2): peças puras do filtro `?staff=` e dos selectores. A API é que filtra e que decide o âmbito
 * («Só os meus»); aqui só se traduz a escolha do selector para o parâmetro.
 */
import type { StaffOption } from "../gen/backoffice/types/StaffOption.js";

/** `all` = Global (omissão) · `none` = Sem profissional · ou o id de um profissional. */
export type StaffFilterValue = string;

export const STAFF_ALL = "all";
export const STAFF_NONE = "none";

/** Valor do query param `staff`: `undefined` no Global (a API assume `all`). */
export function staffParam(value: StaffFilterValue | null | undefined): string | undefined {
  return !value || value === STAFF_ALL ? undefined : value;
}

/** Opções do selector «Global · Sem profissional · <cada profissional>». */
export function staffFilterOptions(staff: readonly Pick<StaffOption, "staffId" | "name" | "active">[]): { value: string; label: string }[] {
  return [
    { value: STAFF_ALL, label: "Global" },
    { value: STAFF_NONE, label: "Sem profissional" },
    ...staff.map((s) => ({ value: s.staffId, label: s.active ? s.name : `${s.name} (inactivo)` })),
  ];
}

/** Opções de um campo «Profissional» / «Vendido por»: só os activos (+ o já escolhido, mesmo inactivo). */
export function staffPickOptions(
  staff: readonly Pick<StaffOption, "staffId" | "name" | "active">[],
  current?: string | null,
  emptyLabel = "Sem profissional",
): { value: string; label: string }[] {
  return [
    { value: "", label: emptyLabel },
    ...staff
      .filter((s) => s.active || s.staffId === current)
      .map((s) => ({ value: s.staffId, label: s.active ? s.name : `${s.name} (inactivo)` })),
  ];
}
