import { fmtEur } from './money'
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
  staff: readonly Pick<StaffOption, "staffId" | "name" | "active" | "doesService">[],
  current?: string | null,
  emptyLabel = "Sem profissional",
): { value: string; label: string; disabled?: boolean }[] {
  return [
    { value: "", label: emptyLabel },
    ...staff
      .filter((s) => s.active || s.staffId === current)
      .map((s) => {
        const base = s.active ? s.name : `${s.name} (inactivo)`;
        // Com `?serviceId=`: quem não faz o serviço fica indicado e desactivado (o já escolhido não se tira à força).
        if (s.doesService === false) return { value: s.staffId, label: `${base} — não faz este serviço`, disabled: s.staffId !== current };
        return { value: s.staffId, label: base };
      }),
  ];
}

/** Âmbito «Só os meus»: o selector fica fixo no profissional ligado (ou avisa que não há ligação). */
export type FixedStaff = { linked: true; staffId: string; name: string } | { linked: false };

export const UNLINKED_STAFF_MESSAGE = "Sem profissional ligado — fala com o dono";

export function fixedStaff(staff: readonly Pick<StaffOption, "staffId" | "name">[], staffId: string | null | undefined): FixedStaff {
  if (!staffId) return { linked: false };
  const s = staff.find((x) => x.staffId === staffId);
  return { linked: true, staffId, name: s?.name ?? "O meu profissional" };
}

/** Dica de preço de um profissional no serviço escolhido (`null` = nada a mostrar). */
export function staffPriceHint(
  staff: readonly Pick<StaffOption, "staffId" | "doesService" | "price">[],
  staffId: string | null | undefined,
): string | null {
  const s = staffId ? staff.find((x) => x.staffId === staffId) : undefined;
  if (!s) return null;
  if (s.doesService === false) return "Este profissional não faz este serviço";
  return s.price != null ? `Preço com este profissional: ${fmtEur(Number(s.price))}` : null;
}
