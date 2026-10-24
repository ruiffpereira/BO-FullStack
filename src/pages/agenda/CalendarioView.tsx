import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addDays, isSameDay, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { useGetScheduleAppointments } from "../../gen/backoffice/hooks/useGetScheduleAppointments.js";
import { usePostScheduleAppointments } from "../../gen/backoffice/hooks/usePostScheduleAppointments.js";
import { usePutScheduleAppointmentsId } from "../../gen/backoffice/hooks/usePutScheduleAppointmentsId.js";
import { useGetScheduleServices } from "../../gen/backoffice/hooks/useGetScheduleServices.js";
import { useGetScheduleWorkingHours } from "../../gen/backoffice/hooks/useGetScheduleWorkingHours.js";
import { useGetScheduleSettings } from "../../gen/backoffice/hooks/useGetScheduleSettings.js";
import { useGetScheduleBlockedSlots, getScheduleBlockedSlotsQueryKey } from "../../gen/backoffice/hooks/useGetScheduleBlockedSlots.js";
import { usePostScheduleBlockedSlots } from "../../gen/backoffice/hooks/usePostScheduleBlockedSlots.js";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { invalidateMoney } from "../../lib/invalidateMoney";
import { patchCustomersId } from "../../gen/backoffice/hooks/usePatchCustomersId.js";
import type { Appointment } from "../../gen/backoffice/types/Appointment.js";
import { ApptModal } from "../../components/ApptModal.js";
import { CalendarSubscribeCard } from "../../components/CalendarSubscribeCard";
import { useNow } from "../../hooks/useNow";
import { useStaffOptions } from "../../hooks/useStaff";
import { STAFF_ALL, staffParam } from "../../lib/staffFilter";
import { toastStaffWarnings } from "../../lib/staffWarnings";
import { AG_H_END, AG_H_START, AG_ROW_H, customerIdForAppointment, minuteToTime, weekStartForDate } from "./geometry";
import { useAgendaCustomers } from "./useAgendaCustomers";
import { CustomerProfileModal } from "../../components/customers/CustomerProfileModal";
import { NovaApptModal } from "./NovaApptModal";


import { CalendarNav } from "./calendario/CalendarNav";
import { StaffChips } from "./calendario/StaffChips";
import { MiniCalendarPopup } from "./calendario/MiniCalendarPopup";
import { GridHeader, HourLabels, NowLine } from "./calendario/GridChrome";
import { DayColumn } from "./calendario/DayColumn";
import { UpcomingCard } from "./calendario/UpcomingCard";
import { ApptDragGhost, DragActionPopup } from "./calendario/DragPopups";
import { useCalendarPointer } from "./calendario/useCalendarPointer";
import type { ApptDragMeta, ApptDragState, DragAction, DragRef, DragSel, HoverSlot, PendingReschedule, RescheduledFrom, TouchTap } from "./calendario/types";

export function CalendarioView() {
  // Só ver (billing read-only ou membro com `view`): o calendário continua a abrir as marcações, mas deixa de
  // criar (arrastar/clicar numa célula) e de reagendar (arrastar uma marcação).
  const { readOnly: writeLocked } = useWriteGuard();
  // "Bloquear horário" é da folha `agenda.bloqueios`, não das marcações: sem `edit` nela a opção nem aparece.
  const { can: canTeam } = useTeamAccess();
  const canBlockSlots = canTeam("agenda.bloqueios", "edit");
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusAppointmentId = searchParams.get("marcacao");
  const [weekStart, setWeekStart] = useState(() =>
    weekStartForDate(searchParams.get("data")),
  );
  const [selAppt, setSelAppt] = useState<Appointment | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(
    null,
  );
  const [rescheduledFrom, setRescheduledFrom] = useState<RescheduledFrom | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<PendingReschedule | null>(null);
  const [novaDate, setNovaDate] = useState<Date | null>(null);
  const [novaTime, setNovaTime] = useState<string | null>(null);

  // Tick de minuto para a risca do "agora" na grelha semanal.
  const now = useNow();

  // Mini calendar
  const [showMiniCal, setShowMiniCal] = useState(false);
  const [miniCalMonth, setMiniCalMonth] = useState(() =>
    startOfMonth(weekStart),
  );
  const miniCalBtnRef = useRef<HTMLButtonElement>(null);

  // Drag-to-select state
  const dragRef = useRef<DragRef | null>(null);
  const [dragSel, setDragSel] = useState<DragSel | null>(null);
  const [dragAction, setDragAction] = useState<DragAction | null>(null);

  // Stable ref setters for use inside useEffect with empty deps
  const setNovaDateRef = useRef(setNovaDate);
  const setNovaTimeRef = useRef(setNovaTime);
  const setDragSelRef = useRef(setDragSel);
  const setDragActionRef = useRef(setDragAction);

  // Appointment reschedule drag
  const apptDragMeta = useRef<ApptDragMeta | null>(null);
  const apptDragTargetRef = useRef<{ day: Date; min: number } | null>(null);
  const [apptDragState, setApptDragState] = useState<ApptDragState | null>(null);
  const setApptDragStateRef = useRef(setApptDragState);
  const setSelApptRef = useRef(setSelAppt);
  const dayColRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Touch: tap-para-prever/agendar (célula vazia), long-press para arrastar marcação,
  // e auto-scroll do container ao arrastar até às bordas.
  const touchTapRef = useRef<TouchTap | null>(null);
  const longPressRef = useRef<number | null>(null);
  const autoScrollRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const autoScrollRafRef = useRef<number | null>(null);
  const calScrollEl = useRef<HTMLDivElement | null>(null);

  // Scroll inicial da grelha: arranca com a hora ATUAL centrada no viewport
  // (mas dá para percorrer o dia todo, 0h–24h).
  const didInitScroll = useRef(false);
  const calScrollRef = useCallback((node: HTMLDivElement | null) => {
    calScrollEl.current = node;
    if (node && !didInitScroll.current) {
      const initNow = new Date();
      const initNowH = initNow.getHours() + initNow.getMinutes() / 60;
      const target = (initNowH - AG_H_START) * AG_ROW_H - node.clientHeight / 2;
      node.scrollTop = Math.max(
        0,
        Math.min(target, node.scrollHeight - node.clientHeight),
      );
      didInitScroll.current = true;
    }
  }, []);
  // Slot da grelha sob o rato (hover) → realce + tooltip dia/hora.
  const [hoverSlot, setHoverSlot] = useState<HoverSlot | null>(null);
  // A hora aparece só ao passar o rato (hover) sobre slots livres — sem toggle.

  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  // O calendário pede exatamente o intervalo de dias que mostra. A semana pode
  // atravessar a virada do mês, por isso filtramos por [from, to] (não por mês).
  const from = format(days[0], "yyyy-MM-dd");
  const to = format(days[days.length - 1], "yyyy-MM-dd");
  const hours = Array.from(
    { length: AG_H_END - AG_H_START },
    (_, i) => AG_H_START + i,
  );

  // Profissionais: filtro por chips (Todos · Sem profissional · cada um, com a sua cor) → `?staff=`.
  const [staffSel, setStaffSel] = useState<string>(STAFF_ALL);
  const { staff: staffList, hasStaff } = useStaffOptions();
  const { data: appointments = [], isLoading } = useGetScheduleAppointments({
    from,
    to,
    ...(staffParam(staffSel) ? { staff: staffParam(staffSel) } : {}),
  });
  const { data: services = [] } = useGetScheduleServices();
  const { scopeOf, staffId: myStaffId } = useTeamAccess();
  // «Só os meus»: sem Todos/Sem profissional/outros, só o profissional ligado (a API filtra de facto).
  const onlyMine = scopeOf("agenda.marcacoes") === "meus";
  const { data: customersData } = useAgendaCustomers();
  const { data: blockedSlots = [] } = useGetScheduleBlockedSlots({ from, to });
  const { data: workingHours = [] } = useGetScheduleWorkingHours();
  // Intervalo da grelha (preferência do tenant). Só visual — a reserva online
  // tem o seu próprio passo na API. Ref para os handlers do efeito de ponteiros.
  const { data: scheduleSettings } = useGetScheduleSettings();
  const slotMin = scheduleSettings?.slotMinutes ?? 15;
  const slotMinRef = useRef(slotMin);
  slotMinRef.current = slotMin;
  // Minutos dentro de cada hora onde a grelha desenha um tick (ex.: 20 → [20, 40]).
  const slotTicks = Array.from(
    { length: Math.ceil(60 / slotMin) - 1 },
    (_, i) => (i + 1) * slotMin,
  );
  const customers = customersData?.rows ?? [];

  // Marcação/pagamento mexe em dinheiro: recalcula também Dashboard, Financeiro e fichas (FI-05).
  const invalidateAppts = () => invalidateMoney(qc);
  const invalidateSlots = () =>
    qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() });

  useEffect(() => {
    const date = searchParams.get("data");
    if (date) setWeekStart(weekStartForDate(date));
  }, [searchParams]);

  useEffect(() => {
    if (!focusAppointmentId || selAppt) return;
    const appt = appointments.find(
      (a) => a.appointmentId === focusAppointmentId,
    );
    if (appt) setSelAppt(appt);
  }, [appointments, focusAppointmentId, selAppt]);

  const closeSelectedAppt = () => {
    setSelAppt(null);
    setRescheduledFrom(null);
    setPendingReschedule(null);
    if (focusAppointmentId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("marcacao");
        next.delete("data");
        return next;
      });
    }
  };

  const createAppt = usePostScheduleAppointments({
    mutation: {
      onSuccess: (data) => {
        toast.success("Marcação criada");
        toastStaffWarnings(data?.warnings);
        invalidateAppts();
        setNovaDate(null);
        setNovaTime(null);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  // Guardar = notificar: o backend avisa o cliente automaticamente ao
  // criar/editar/cancelar. O frontend só guarda.
  const updateAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: (data) => {
        invalidateAppts();
        toast.success("Marcação actualizada");
        toastStaffWarnings(data?.warnings);
        setPendingReschedule(null);
        setRescheduledFrom(null);
        setSelAppt(null);
      },
      onError: (error) => {
        toast.error(getApiError(error));
      },
    },
  });
  // "Editar marcação": reverte para confirmada SEM fechar a modal (ao contrário do updateAppt).
  const reopenAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        invalidateAppts();
        toast.success("Marcação reaberta para edição");
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const lastStatusRef = useRef<string | null>(null);
  const setStatusAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        invalidateAppts();
        toast.success(
          lastStatusRef.current === "cancelled"
            ? "Marcação cancelada"
            : "Marcação reativada",
        );
        setPendingReschedule(null);
        setRescheduledFrom(null);
        setSelAppt(null);
      },
      onError: (error) => {
        toast.error(getApiError(error));
      },
    },
  });
  const blockSlot = usePostScheduleBlockedSlots({
    mutation: {
      onSuccess: () => {
        toast.success("Horário bloqueado");
        invalidateSlots();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  useCalendarPointer({
    dragRef, apptDragMeta, apptDragTargetRef, longPressRef, autoScrollRef, autoScrollRafRef, calScrollEl,
    dayColRefs, slotMinRef, setNovaDateRef, setNovaTimeRef, setDragSelRef, setDragActionRef,
    setApptDragStateRef, setSelApptRef, setPendingReschedule, setRescheduledFrom,
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const upcoming = useMemo(
    () =>
      (appointments as Appointment[])
        .filter(
          (a) =>
            a.status !== "cancelled" &&
            (a.date > today ||
              (a.date === today && a.time >= format(new Date(), "HH:mm"))),
        )
        .sort((a, b) =>
          a.date !== b.date
            ? a.date.localeCompare(b.date)
            : a.time.localeCompare(b.time),
        )
        .slice(0, 10),
    [appointments, today],
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] xl:grid-rows-[minmax(0,1fr)] gap-4 items-start xl:items-stretch xl:h-full xl:min-h-0">
      {/* Altura por flex: a partir de xl o Shell dá a altura (grelha h-full) e o calendário enche-a; abaixo de xl a página
          faz scroll e o cartão tem uma altura própria (conteúdo, não uma medida do viewport). */}
      <Card className="overflow-hidden flex flex-col h-[560px] xl:h-auto xl:min-h-0">
        {/* ── Navegação ── */}
        <CalendarNav
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          showMiniCal={showMiniCal}
          miniCalBtnRef={miniCalBtnRef}
          onToggleMini={() => {
            setMiniCalMonth(startOfMonth(weekStart));
            setShowMiniCal((v) => !v);
          }}
        />

        {/* ── Filtro por profissional (só se o tenant tem profissionais) ── */}
        <StaffChips
          hasStaff={hasStaff}
          onlyMine={onlyMine}
          myStaffId={myStaffId}
          staffList={staffList}
          staffSel={staffSel}
          setStaffSel={setStaffSel}
        />

        {/* ── Mini calendar popup ── */}
        <MiniCalendarPopup
          showMiniCal={showMiniCal}
          setShowMiniCal={setShowMiniCal}
          miniCalBtnRef={miniCalBtnRef}
          miniCalMonth={miniCalMonth}
          setMiniCalMonth={setMiniCalMonth}
          days={days}
          setWeekStart={setWeekStart}
        />

        {/* ── Área com scroll ── */}
        <div ref={calScrollRef} className="overflow-auto flex-1 min-h-0">
          <div className="min-w-[600px]">
            {/* cabeçalho dos dias — sticky */}
            <GridHeader days={days} />

            {/* grelha de horas */}
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}
            >
              <HourLabels hours={hours} />
              {days.map((day) => (
                <DayColumn
                  key={day.toISOString()}
                  day={day}
                  appointments={appointments as Appointment[]}
                  services={services}
                  blockedSlots={blockedSlots}
                  workingHours={workingHours}
                  pendingReschedule={pendingReschedule}
                  dragSel={dragSel}
                  apptDragState={apptDragState}
                  hoverSlot={hoverSlot}
                  isLoading={isLoading}
                  writeLocked={writeLocked}
                  slotMin={slotMin}
                  slotTicks={slotTicks}
                  hours={hours}
                  dayColRefs={dayColRefs}
                  dragRef={dragRef}
                  touchTapRef={touchTapRef}
                  apptDragMeta={apptDragMeta}
                  longPressRef={longPressRef}
                  setHoverSlot={setHoverSlot}
                  setDragSel={setDragSel}
                  setNovaDate={setNovaDate}
                  setNovaTime={setNovaTime}
                  setApptDragState={setApptDragState}
                  setSelAppt={setSelAppt}
                />
              ))}

              {/* Risca do "AGORA" — só quando a semana visível contém hoje. */}
              {days.some((d) => isSameDay(d, now)) && <NowLine days={days} now={now} />}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto">
        <Card className="p-4">
          <GuardButton
            className="w-full"
            wrapperClassName="block w-full"
            icon="plus"
            onClick={() => {
              setNovaDate(new Date());
              setNovaTime(null);
            }}
          >
            Nova marcação
          </GuardButton>
        </Card>
        <CalendarSubscribeCard />
        <UpcomingCard upcoming={upcoming} services={services} today={today} onSelect={setSelAppt} />
      </div>

      {dragAction && (
        <DragActionPopup
          dragAction={dragAction}
          canBlockSlots={canBlockSlots}
          onClose={() => setDragAction(null)}
          onNova={(day, startMin) => {
            setNovaDate(day);
            setNovaTime(minuteToTime(startMin));
          }}
          onBlock={(data) => blockSlot.mutate({ data })}
        />
      )}

      {apptDragState && <ApptDragGhost apptDragState={apptDragState} services={services} />}

      {selAppt && (
        <ApptModal
          appt={
            rescheduledFrom
              ? selAppt
              : (appointments.find(
                  (a) => a.appointmentId === selAppt.appointmentId,
                ) ?? selAppt)
          }
          services={services}
          onClose={closeSelectedAppt}
          onSave={(id, data) => updateAppt.mutate({ id, data })}
          onSetStatus={(id, status, data) => {
            lastStatusRef.current = status;
            setStatusAppt.mutate({ id, data: { status, ...data } });
          }}
          rescheduledFrom={rescheduledFrom ?? undefined}
          initialDate={pendingReschedule?.newDate}
          initialTime={pendingReschedule?.newTime}
          isSaving={updateAppt.isPending}
          isSettingStatus={setStatusAppt.isPending}
          priorDebt={(appointments.find((a) => a.appointmentId === selAppt.appointmentId) ?? selAppt).priorDebt ?? 0}
          customer={(() => {
            const ca = appointments.find((a) => a.appointmentId === selAppt.appointmentId) ?? selAppt;
            const cid = customerIdForAppointment(ca, customers);
            const c = cid ? customers.find((x) => x.customerId === cid) : null;
            return c ? { customerId: c.customerId, nif: c.nif ?? null, wantsInvoice: c.wantsInvoice ?? false } : null;
          })()}
          onSaveCustomer={(id, data) => {
            patchCustomersId(id, data).then(() => qc.invalidateQueries({ queryKey: getCustomersQueryKey() }));
          }}
          onReopen={(id) => reopenAppt.mutate({ id, data: { status: "confirmed" } as any })}
          onOpenCustomer={(() => {
            const currentAppt = rescheduledFrom
              ? selAppt
              : (appointments.find(
                  (a) => a.appointmentId === selAppt.appointmentId,
                ) ?? selAppt);
            const customerId = customerIdForAppointment(currentAppt, customers);
            return customerId
              ? () => setProfileCustomerId(customerId)
              : undefined;
          })()}
        />
      )}
      {profileCustomerId && (
        <CustomerProfileModal
          customerId={profileCustomerId}
          customers={customers}
          onClose={() => setProfileCustomerId(null)}
          onOpenAppointment={(appt) => {
            setProfileCustomerId(null);
            setRescheduledFrom(null);
            setPendingReschedule(null);
            setSelAppt(appt);
          }}
        />
      )}
      {novaDate && (
        <NovaApptModal
          date={novaDate}
          open
          onClose={() => {
            setNovaDate(null);
            setNovaTime(null);
          }}
          services={services}
          onCreate={(data) => createAppt.mutate({ data })}
          isPending={createAppt.isPending}
          initialTime={novaTime ?? undefined}
        />
      )}
    </div>
  );
}
