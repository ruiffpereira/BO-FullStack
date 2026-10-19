/**
 * Formulário do profissional (R2) — lógica PURA: serviços que faz, preço próprio e horário.
 * A API é a fonte da verdade (preço da marcação, quem pode gravar preços); aqui só se prepara o corpo dos PUTs.
 */
import type { StaffServiceRule } from "../gen/backoffice/types/StaffServiceRule.js";
import type { StaffWorkingHoursDay } from "../gen/backoffice/types/StaffWorkingHoursDay.js";

export interface ServiceLite {
  serviceId: string;
  name: string;
  price?: number | null;
  active?: boolean;
}

export interface ServiceRow {
  serviceId: string;
  name: string;
  /** Preço normal do serviço (só para mostrar). */
  price: number | null;
  active: boolean;
  /** `true` = faz o serviço (por omissão todos); desmarcar = excluído. */
  does: boolean;
  /** Preço próprio em texto (vazio = o normal). */
  ownPrice: string;
}

/** Uma linha por serviço: faz tudo ao preço normal, salvo as excepções guardadas. */
export function rowsFromRules(services: readonly ServiceLite[], rules: readonly StaffServiceRule[] | undefined | null): ServiceRow[] {
  const byId = new Map((rules ?? []).map((r) => [r.serviceId, r]));
  return services.map((s) => {
    const r = byId.get(s.serviceId);
    return {
      serviceId: s.serviceId,
      name: s.name,
      price: s.price == null ? null : Number(s.price),
      active: s.active !== false,
      does: !r?.excluded,
      ownPrice: r?.price != null ? String(r.price) : "",
    };
  });
}

/** Preço próprio: `""` → `null` (o normal); número ≥ 0 → o número; lixo/negativo → `undefined` (inválido). */
export function parseOwnPrice(v: string): number | null | undefined {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Primeiro erro de validação do formulário de serviços (ou `null`). */
export function validateServiceRows(rows: readonly ServiceRow[]): string | null {
  for (const r of rows) {
    if (r.does && parseOwnPrice(r.ownPrice) === undefined) return `Preço inválido em «${r.name}».`;
  }
  return null;
}

/**
 * Corpo do `PUT /schedule/staff/:id/services` (lista completa; ausência = faz ao preço normal): só vão as
 * excepções — excluído, ou com preço próprio. Quem não tem `agenda.profissionais.precos` envia o preço tal como
 * estava (a API ignora-o de qualquer forma).
 */
export function rulesFromRows(rows: readonly ServiceRow[]): StaffServiceRule[] {
  const out: StaffServiceRule[] = [];
  for (const r of rows) {
    if (!r.does) {
      out.push({ serviceId: r.serviceId, excluded: true, price: null });
      continue;
    }
    const price = parseOwnPrice(r.ownPrice);
    if (price != null) out.push({ serviceId: r.serviceId, excluded: false, price });
  }
  return out;
}

/* ───────────────────────── Horário ───────────────────────── */

/** Segunda → domingo (a API usa 0 = domingo). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_LABEL: Record<number, string> = { 0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado" };

/** Os 7 dias para editar: o que a API devolveu, e o que falta fica fechado (09:00–18:00). */
export function weekFromHours(hours: readonly StaffWorkingHoursDay[] | undefined | null): StaffWorkingHoursDay[] {
  const byDay = new Map((hours ?? []).map((h) => [h.dayOfWeek, h]));
  return WEEK_ORDER.map((d) => {
    const h = byDay.get(d);
    return h
      ? { ...h, lunchStart: h.lunchStart ?? null, lunchEnd: h.lunchEnd ?? null }
      : { dayOfWeek: d, startTime: "09:00", endTime: "18:00", isActive: false, lunchStart: null, lunchEnd: null };
  });
}

/** Primeiro erro do horário próprio (fecho ≤ abertura num dia aberto), ou `null`. */
export function validateWeek(week: readonly StaffWorkingHoursDay[]): string | null {
  for (const d of week) {
    if (d.isActive && d.endTime <= d.startTime) return `${DAY_LABEL[d.dayOfWeek]}: o fecho tem de ser depois da abertura.`;
  }
  return null;
}

/* ───────────────────────── Férias e folgas ───────────────────────── */

/** Erro do formulário de férias/folga (ou `null`): datas obrigatórias, fim ≥ início; horas só num dia. */
export function validateTimeOff(f: { startDate: string; endDate: string; startTime: string; endTime: string }): string | null {
  if (!f.startDate || !f.endDate) return "Indica as datas.";
  if (f.endDate < f.startDate) return "O fim não pode ser antes do início.";
  if (f.startTime || f.endTime) {
    if (!f.startTime || !f.endTime) return "Indica a hora de início e a de fim.";
    if (f.startDate !== f.endDate) return "Uma janela de horas só vale num dia.";
    if (f.endTime <= f.startTime) return "A hora de fim tem de ser depois da de início.";
  }
  return null;
}

/** Cores sugeridas para a agenda. */
export const STAFF_COLORS = ["#2A6FDB", "#1F8A5B", "#7C5CDB", "#E0733A", "#D6457A", "#0E9AA7", "#B8860B", "#6B7280"] as const;
