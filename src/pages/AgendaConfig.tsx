import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../lib/apiError";
import { Icon } from "../ui/icons.jsx";
import { Card, Button, IconButton, Badge, Modal, Input, Toggle, EmptyState, BADGE_TONES } from "../ui/ui.jsx";
import { DatePicker } from "../components/DatePicker";
import {
  useGetScheduleWorkingHours,
  getScheduleWorkingHoursQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleWorkingHours.js";
import { usePostScheduleWorkingHours } from "../gen/backoffice/hooks/usePostScheduleWorkingHours.js";
import {
  useGetScheduleBlockedSlots,
  getScheduleBlockedSlotsQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleBlockedSlots.js";
import { usePostScheduleBlockedSlots } from "../gen/backoffice/hooks/usePostScheduleBlockedSlots.js";
import { useDeleteScheduleBlockedSlotsId } from "../gen/backoffice/hooks/useDeleteScheduleBlockedSlotsId.js";
import { usePostScheduleBlockedSlotsVacation } from "../gen/backoffice/hooks/usePostScheduleBlockedSlotsVacation.js";
import type { WorkingHours } from "../gen/backoffice/types/WorkingHours.js";

// ── Constantes / helpers ─────────────────────────────────────────────────────
const FULL_DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SHORT_DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DEFAULT_WORKING_HOURS: WorkingHours[] = FULL_DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  startTime: "09:00",
  endTime: "18:00",
  isActive: i !== 0,
  lunchStart: null,
  lunchEnd: null,
}));

function normalizeWorkingHours(hours: WorkingHours[]) {
  return [...hours]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime || "09:00",
      endTime: h.endTime || "18:00",
      isActive: h.isActive !== false,
      lunchStart: h.lunchStart || null,
      lunchEnd: h.lunchEnd || null,
    }));
}
function workingHoursChanged(a: WorkingHours[], b: WorkingHours[]) {
  return JSON.stringify(normalizeWorkingHours(a)) !== JSON.stringify(normalizeWorkingHours(b));
}

// Opções HH:MM (15 min, 06:00–23:45) + garante que o valor atual aparece na lista.
const BASE_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) for (const m of [0, 15, 30, 45]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out;
})();
const timeOptions = (value?: string | null) => {
  const set = new Set(BASE_TIMES);
  if (value) set.add(value);
  return [...set].sort();
};
const hhmmToH = (t?: string | null) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; };
const fmtDataCurta = (s?: string | null) => { if (!s) return "—"; const [, m, d] = s.split("-"); return `${+d} ${MES[+m - 1]}`; };
const addDayStr = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Seletor de hora compacto (popover, sem control nativo) — estilo do protótipo.
// `before`/`after` (HH:MM) restringem as opções (ex.: fecho > abertura).
function TimeField({ value, onChange, before, after, tone = "default" }: {
  value: string;
  onChange: (v: string) => void;
  before?: string;
  after?: string;
  tone?: "default" | "lunch";
}) {
  const [open, setOpen] = useState(false);
  const opts = timeOptions(value).filter((t) => (before == null || t < before) && (after == null || t > after));
  const toneCls = tone === "lunch"
    ? "border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:border-amber-400"
    : "border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 hover:border-accent";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded-lg border pl-2.5 pr-2 py-1.5 text-[13px] font-medium tabular-nums transition ${toneCls}`}>
        {value}
        <Icon name="chevronDown" className={`w-3.5 h-3.5 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 left-0 w-24 max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-1 animate-[pop_.12s_ease]">
            {opts.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] tabular-nums transition ${t === value ? "bg-accent text-white font-medium" : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Barra visual de cobertura do dia (abertura preenchida, almoço recortado).
function DayBar({ startTime, endTime, lunchStart, lunchEnd }: { startTime: string; endTime: string; lunchStart: string | null; lunchEnd: string | null }) {
  const START = 6, END = 24, span = END - START;
  const pos = (h: number) => `${((Math.max(START, Math.min(END, h)) - START) / span) * 100}%`;
  const wid = (a: number, b: number) => `${((Math.min(END, b) - Math.max(START, a)) / span) * 100}%`;
  const ini = hhmmToH(startTime), fim = hhmmToH(endTime);
  const hasLunch = !!(lunchStart && lunchEnd);
  const li = hhmmToH(lunchStart), lf = hhmmToH(lunchEnd);
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className="absolute inset-y-0 bg-accent/35" style={{ left: pos(ini), width: wid(ini, fim) }} />
        {hasLunch && <div className="absolute inset-y-0 bg-zinc-100 dark:bg-zinc-800" style={{ left: pos(li), width: wid(li, lf) }} />}
        {hasLunch && <div className="absolute inset-y-0 border-x border-amber-400/70" style={{ left: pos(li), width: wid(li, lf) }} />}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-zinc-300 dark:text-zinc-600 tabular-nums">
        <span>06h</span><span>12h</span><span>18h</span><span>24h</span>
      </div>
    </div>
  );
}

// Editor de horário (dentro da modal): toggle + horas + almoço + copiar + barra.
function HorarioEditor({ hours, updateDay, onCopyAll }: {
  hours: WorkingHours[];
  updateDay: (dayOfWeek: number, patch: Partial<WorkingHours>) => void;
  onCopyAll: (dayOfWeek: number) => void;
}) {
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 -my-1">
      {hours.map((h) => {
        const hasLunch = !!(h.lunchStart && h.lunchEnd);
        return (
          <div key={h.dayOfWeek} className="py-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-x-5 gap-y-3">
              <div className="flex items-center gap-3 w-full lg:w-40 shrink-0">
                <Toggle checked={h.isActive} onChange={(v: boolean) => updateDay(h.dayOfWeek, { isActive: v })} />
                <div>
                  <p className={`font-medium text-sm ${h.isActive ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400"}`}>{FULL_DAY_NAMES[h.dayOfWeek]}</p>
                  <p className="text-xs text-zinc-400">{h.isActive ? "Aberto" : "Fechado"}</p>
                </div>
              </div>
              {h.isActive ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <TimeField value={h.startTime} before={h.endTime} onChange={(v) => updateDay(h.dayOfWeek, { startTime: v })} />
                    <span className="text-zinc-300 dark:text-zinc-600 text-sm">–</span>
                    <TimeField value={h.endTime} after={h.startTime} onChange={(v) => updateDay(h.dayOfWeek, { endTime: v })} />
                  </div>
                  <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${hasLunch ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}>
                    <button
                      type="button"
                      onClick={() => hasLunch ? updateDay(h.dayOfWeek, { lunchStart: null, lunchEnd: null }) : updateDay(h.dayOfWeek, { lunchStart: "13:00", lunchEnd: "14:00" })}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${hasLunch ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}
                    >
                      <Icon name="clock" className="w-3.5 h-3.5" />Almoço
                    </button>
                    {hasLunch && (
                      <div className="flex items-center gap-1">
                        <TimeField value={h.lunchStart as string} after={h.startTime} before={h.lunchEnd as string} onChange={(v) => updateDay(h.dayOfWeek, { lunchStart: v })} tone="lunch" />
                        <span className="text-amber-400/60 text-xs">–</span>
                        <TimeField value={h.lunchEnd as string} after={h.lunchStart as string} before={h.endTime} onChange={(v) => updateDay(h.dayOfWeek, { lunchEnd: v })} tone="lunch" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopyAll(h.dayOfWeek)}
                    title="Copiar este horário para os outros dias abertos"
                    className="lg:ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-accent transition px-2 py-1 rounded-lg hover:bg-accent/[0.06]"
                  >
                    <Icon name="layers" className="w-3.5 h-3.5" />Copiar p/ todos
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 lg:py-1.5">Sem atendimento neste dia.</p>
              )}
            </div>
            {h.isActive && <div className="mt-3 lg:ml-40 lg:pl-5"><DayBar startTime={h.startTime} endTime={h.endTime} lunchStart={h.lunchStart} lunchEnd={h.lunchEnd} /></div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Bloqueios: agrupar dias consecutivos (mesmo motivo) em períodos ──────────
type BlockedSlotRow = { blockedSlotId: string; date: string; startTime: string | null; endTime: string | null; reason: string | null };
type Periodo = { kind: "range" | "single" | "partial"; de: string; ate: string; reason: string | null; startTime?: string | null; endTime?: string | null; ids: string[] };

const PERIODO_META = {
  range: { t: "Férias", tone: "violet" as const, icon: "star" },
  single: { t: "Feriado", tone: "red" as const, icon: "calendar" },
  partial: { t: "Bloqueio", tone: "amber" as const, icon: "ban" },
};

function groupBlocked(slots: BlockedSlotRow[]): Periodo[] {
  const full = slots.filter((s) => !s.startTime && !s.endTime).sort((a, b) => a.date.localeCompare(b.date));
  const partial = slots.filter((s) => s.startTime || s.endTime);
  const out: Periodo[] = [];
  let cur: Periodo | null = null;
  for (const s of full) {
    if (cur && (s.reason ?? "") === (cur.reason ?? "") && s.date === addDayStr(cur.ate, 1)) {
      cur.ate = s.date;
      cur.ids.push(s.blockedSlotId);
    } else {
      if (cur) out.push(cur);
      cur = { kind: "single", de: s.date, ate: s.date, reason: s.reason, ids: [s.blockedSlotId] };
    }
  }
  if (cur) out.push(cur);
  for (const p of out) if (p.de !== p.ate) p.kind = "range";
  for (const s of partial) out.push({ kind: "partial", de: s.date, ate: s.date, reason: s.reason, startTime: s.startTime, endTime: s.endTime, ids: [s.blockedSlotId] });
  return out.sort((a, b) => a.de.localeCompare(b.de));
}

// ── Modal: adicionar período (férias / feriado / bloqueio pontual) ───────────
function BloqueioModal({ open, onClose, onSave, pending }: {
  open: boolean;
  onClose: () => void;
  onSave: (f: { de: string; ate: string; inteiro: boolean; startTime: string; endTime: string; motivo: string }) => void;
  pending: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const empty = { de: hoje, ate: hoje, inteiro: true, startTime: "09:00", endTime: "13:00", motivo: "" };
  const [form, setForm] = useState(empty);
  useEffect(() => { if (open) setForm(empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = form.de !== form.ate;
  const invalid = !form.de || !form.ate || form.ate < form.de || (!range && !form.inteiro && form.startTime >= form.endTime);
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title="Adicionar período"
      subtitle="Bloqueia datas por férias, feriados ou imprevistos. Aparecem tracejadas no calendário."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" isLoading={pending} disabled={invalid} onClick={() => onSave(form)}>Bloquear</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">De</span>
            <DatePicker value={form.de} min={hoje} onChange={(v) => setForm((f) => ({ ...f, de: v, ate: f.ate < v ? v : f.ate }))} />
          </div>
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Até</span>
            <DatePicker value={form.ate} min={form.de} onChange={(v) => setForm((f) => ({ ...f, ate: v }))} />
          </div>
        </div>
        {!range && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Dia inteiro</p><p className="text-xs text-zinc-400">Desliga para bloquear só um intervalo de horas.</p></div>
            <Toggle checked={form.inteiro} onChange={(v: boolean) => setForm((f) => ({ ...f, inteiro: v }))} />
          </div>
        )}
        {!range && !form.inteiro && (
          <div className="flex items-center gap-2">
            <TimeField value={form.startTime} before={form.endTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
            <span className="text-zinc-400 text-sm">–</span>
            <TimeField value={form.endTime} after={form.startTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
          </div>
        )}
        <Input label="Motivo (opcional)" value={form.motivo} onChange={(e: any) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Férias de verão" />
        {range && <p className="text-xs text-zinc-400">Bloqueia todos os dias de <strong>{fmtDataCurta(form.de)}</strong> a <strong>{fmtDataCurta(form.ate)}</strong> (dia inteiro).</p>}
      </div>
    </Modal>
  );
}

// ── Painel de Configurações da Agenda ────────────────────────────────────────
export function ConfiguracoesPanel() {
  const qc = useQueryClient();
  const [horarioOpen, setHorarioOpen] = useState(false);
  const [bloqueioOpen, setBloqueioOpen] = useState(false);

  // Horário semanal
  const { data: savedHours, isLoading: loadingHours } = useGetScheduleWorkingHours();
  const [hours, setHours] = useState<WorkingHours[]>(DEFAULT_WORKING_HOURS);
  const [savedSnap, setSavedSnap] = useState<WorkingHours[]>(DEFAULT_WORKING_HOURS);
  useEffect(() => {
    const next = savedHours && savedHours.length > 0
      ? DEFAULT_WORKING_HOURS.map((def) => savedHours.find((h) => h.dayOfWeek === def.dayOfWeek) ?? def)
      : DEFAULT_WORKING_HOURS;
    setHours(next);
    setSavedSnap(next);
  }, [savedHours]);
  const hasUnsaved = workingHoursChanged(hours, savedSnap);
  const updateDay = (dayOfWeek: number, patch: Partial<WorkingHours>) =>
    setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)));
  const onCopyAll = (dayOfWeek: number) => {
    const src = hours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!src) return;
    setHours((prev) => prev.map((h) => (h.isActive ? { ...h, startTime: src.startTime, endTime: src.endTime, lunchStart: src.lunchStart, lunchEnd: src.lunchEnd } : h)));
  };
  const saveHours = usePostScheduleWorkingHours({
    mutation: {
      onSuccess: () => { toast.success("Horários guardados"); setSavedSnap(hours); qc.invalidateQueries({ queryKey: getScheduleWorkingHoursQueryKey() }); },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const abertos = hours.filter((h) => h.isActive).length;

  // Férias & bloqueios
  const { data: blockedSlots = [], isLoading: loadingSlots } = useGetScheduleBlockedSlots(undefined);
  const periodos = useMemo(() => groupBlocked(blockedSlots as BlockedSlotRow[]), [blockedSlots]);
  const invalidateSlots = () => qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() });
  const createSlot = usePostScheduleBlockedSlots({
    mutation: { onSuccess: () => { toast.success("Bloqueio criado"); invalidateSlots(); setBloqueioOpen(false); }, onError: (error) => toast.error(getApiError(error)) },
  });
  const vacation = usePostScheduleBlockedSlotsVacation({
    mutation: { onSuccess: (data: any) => { toast.success(data?.message ?? "Período bloqueado"); invalidateSlots(); setBloqueioOpen(false); }, onError: (error: any) => toast.error(getApiError(error)) },
  });
  const deleteSlot = useDeleteScheduleBlockedSlotsId({ mutation: { onError: (error) => toast.error(getApiError(error)) } });
  const removePeriodo = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deleteSlot.mutateAsync({ id })));
      toast.success(ids.length > 1 ? "Período removido" : "Bloqueio removido");
    } catch (error) {
      toast.error(getApiError(error));
    }
    invalidateSlots();
  };
  const onAddPeriodo = (f: { de: string; ate: string; inteiro: boolean; startTime: string; endTime: string; motivo: string }) => {
    if (f.de !== f.ate) {
      vacation.mutate({ data: { startDate: f.de, endDate: f.ate, reason: f.motivo || undefined } as any });
    } else {
      createSlot.mutate({ data: { date: f.de, startTime: f.inteiro ? undefined : f.startTime, endTime: f.inteiro ? undefined : f.endTime, reason: f.motivo || undefined } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Horário semanal — resumo + editor em modal */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="clock" className="w-4 h-4 text-zinc-400 shrink-0" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">Horário semanal</h3>
            <span className="text-xs text-zinc-400">· {abertos} dias abertos</span>
          </div>
          <Button variant="outline" size="sm" icon="edit" onClick={() => setHorarioOpen(true)}>Editar</Button>
        </div>
        {loadingHours ? (
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {hours.map((h) => (
              <span key={h.dayOfWeek} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] ${h.isActive ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200" : "text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-700"}`}>
                <span className="font-medium">{SHORT_DAY_NAMES[h.dayOfWeek]}</span>
                {h.isActive ? (
                  <span className="tabular-nums">{h.startTime}–{h.endTime}{h.lunchStart && h.lunchEnd && <span className="text-amber-500"> · {h.lunchStart}–{h.lunchEnd}</span>}</span>
                ) : <span>Fechado</span>}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Férias & dias bloqueados */}
      <div className="space-y-4">
        <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">Férias & dias bloqueados</h3>
            <p className="text-[13px] text-zinc-500 mt-0.5">Datas sem atendimento. Aparecem tracejadas no calendário.</p>
          </div>
          <Button icon="plus" className="sm:ml-auto shrink-0" onClick={() => setBloqueioOpen(true)}>Adicionar período</Button>
        </Card>
        {loadingSlots ? (
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : periodos.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {periodos.map((p) => {
              const meta = PERIODO_META[p.kind];
              const label = p.kind === "partial"
                ? `${fmtDataCurta(p.de)} · ${p.startTime}–${p.endTime}`
                : p.de === p.ate ? fmtDataCurta(p.de) : `${fmtDataCurta(p.de)} – ${fmtDataCurta(p.ate)}`;
              return (
                <Card key={p.ids[0]} className="p-4 flex items-center gap-3 group">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[meta.tone]}`}><Icon name={meta.icon} className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="font-medium text-zinc-900 dark:text-white text-sm truncate">{p.reason || meta.t}</p><Badge tone={meta.tone}>{meta.t}</Badge></div>
                    <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
                  </div>
                  <IconButton icon="trash" label="Remover" onClick={() => removePeriodo(p.ids)} className="opacity-0 group-hover:opacity-100 hover:text-red-500" />
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><EmptyState icon="calendar" title="Sem períodos bloqueados" desc="Usa “Adicionar período” (acima) para bloquear férias, feriados ou um dia." /></Card>
        )}
      </div>

      {/* Modal: editor de horário semanal */}
      <Modal
        open={horarioOpen}
        onClose={() => setHorarioOpen(false)}
        width="max-w-2xl"
        title="Horário semanal"
        subtitle="Horas de abertura e pausa de almoço de cada dia. Usa “Copiar p/ todos” para replicar um dia."
        footer={<><Button variant="ghost" onClick={() => setHorarioOpen(false)}>Fechar</Button><Button icon="check" variant={hasUnsaved ? "primary" : "secondary"} isLoading={saveHours.isPending} disabled={!hasUnsaved} onClick={() => saveHours.mutate({ data: { hours } })}>{hasUnsaved ? "Guardar horários" : "Sem alterações"}</Button></>}
      >
        <HorarioEditor hours={hours} updateDay={updateDay} onCopyAll={onCopyAll} />
      </Modal>

      <BloqueioModal open={bloqueioOpen} onClose={() => setBloqueioOpen(false)} onSave={onAddPeriodo} pending={createSlot.isPending || vacation.isPending} />
    </div>
  );
}
