import { useState, useRef } from "react";
import {
  format,
  startOfMonth,
  eachDayOfInterval,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";
import { Icon } from "../ui/icons.jsx";
import { Modal, Avatar, Badge, Button } from "../ui/ui.jsx";
import type {
  Appointment,
  AppointmentStatusEnum,
} from "../gen/backoffice/types/Appointment.js";
import type { Service } from "../gen/backoffice/types/Service.js";

export const STATUS_LABELS: Record<AppointmentStatusEnum, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const SERVICE_COLORS = [
  "#2A6FDB",
  "#1F8A5B",
  "#D97757",
  "#7C5CDB",
  "#E6B450",
  "#0EA5A4",
  "#DB2A6F",
  "#5C2ADB",
];

function stableColorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SERVICE_COLORS[h % SERVICE_COLORS.length];
}

export function colorForService(
  serviceId: string,
  services: Service[],
): string {
  const svc = services.find((s) => s.serviceId === serviceId);
  return svc?.color ?? stableColorForId(serviceId);
}

const DAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_TONE: Record<AppointmentStatusEnum, string> = {
  pending: "amber",
  confirmed: "green",
  completed: "green",
  cancelled: "red",
};

export function ApptModal({
  appt,
  services,
  onClose,
  onSave,
  onSetStatus,
  isSaving,
  isSettingStatus,
  rescheduledFrom,
  initialDate,
  initialTime,
  onSaveAndNotify,
  isNotifying,
  onOpenCustomer,
  onReactivateAndNotify,
}: {
  appt: Appointment;
  services: Service[];
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
  onSetStatus: (id: string, status: AppointmentStatusEnum) => void;
  isSaving: boolean;
  isSettingStatus?: boolean;
  rescheduledFrom?: { date: string; time: string };
  initialDate?: string;
  initialTime?: string;
  onSaveAndNotify?: (id: string, data: Record<string, unknown>) => void;
  isNotifying?: boolean;
  onOpenCustomer?: () => void;
  onReactivateAndNotify?: (id: string) => void;
}) {
  const [editServiceId, setEditServiceId] = useState(appt.serviceId);
  const svc = services.find((s) => s.serviceId === editServiceId);
  const status = appt.status ?? "pending";
  const canEdit = status === "pending" || status === "confirmed";
  const [tab, setTab] = useState<"details" | "payment">("details");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [editTime, setEditTime] = useState(initialTime ?? appt.time);
  const [editDate, setEditDate] = useState(initialDate ?? appt.date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() =>
    startOfMonth(parseISO(initialDate ?? appt.date)),
  );
  const datePickerBtnRef = useRef<HTMLButtonElement>(null);

  const originalDuration = appt.duration ?? svc?.duration ?? 30;
  const [editDuration, setEditDuration] = useState(originalDuration);

  const [cash, setCash] = useState(
    appt.paymentCash != null ? String(appt.paymentCash) : "",
  );
  const [mbway, setMbway] = useState(
    appt.paymentMbway != null ? String(appt.paymentMbway) : "",
  );
  const [card, setCard] = useState(
    appt.paymentCard != null ? String(appt.paymentCard) : "",
  );
  const [tip, setTip] = useState("");
  const [cancelPayment, setCancelPayment] = useState(false);

  const isPaid = !!appt.paidAt;
  const tipVal = parseFloat(tip) || 0;
  const payTotal =
    (parseFloat(cash) || 0) +
    (parseFloat(mbway) || 0) +
    (parseFloat(card) || 0) +
    tipVal;
  const price = Number(svc?.price ?? 0);
  const isExact = payTotal > 0 && Math.abs(payTotal - price) < 0.01;
  const isOver = payTotal > price + 0.01;

  const paymentChanged =
    cancelPayment ||
    (parseFloat(cash) || 0) + tipVal !== Number(appt.paymentCash ?? 0) ||
    (parseFloat(mbway) || 0) !== Number(appt.paymentMbway ?? 0) ||
    (parseFloat(card) || 0) !== Number(appt.paymentCard ?? 0);
  const detailsChanged =
    editTime !== appt.time ||
    editDate !== appt.date ||
    editServiceId !== appt.serviceId ||
    editDuration !== originalDuration;
  const hasChanges = detailsChanged || paymentChanged;

  const pickerGridStart = startOfWeek(startOfMonth(pickerMonth), {
    weekStartsOn: 1,
  });
  const pickerGridDays = eachDayOfInterval({
    start: pickerGridStart,
    end: addDays(pickerGridStart, 41),
  });
  const parsedEditDate = parseISO(editDate);

  const serviceColor = colorForService(appt.serviceId, services);

  const buildSaveData = () => {
    const data: Record<string, unknown> = {};
    if (editTime !== appt.time) data.time = editTime;
    if (editDate !== appt.date) data.date = editDate;
    if (editServiceId !== appt.serviceId) data.serviceId = editServiceId;
    if (editDuration !== originalDuration) data.duration = editDuration;
    if (cancelPayment) {
      data.cancelPayment = true;
    } else if (paymentChanged) {
      data.paymentCash = (parseFloat(cash) || 0) + tipVal;
      data.paymentMbway = parseFloat(mbway) || 0;
      data.paymentCard = parseFloat(card) || 0;
    }
    return data;
  };

  const handleSave = () => {
    const data = buildSaveData();
    if (Object.keys(data).length) onSave(appt.appointmentId, data);
  };

  const handleSaveAndNotify = () => {
    const data = buildSaveData();
    if (Object.keys(data).length && onSaveAndNotify)
      onSaveAndNotify(appt.appointmentId, data);
  };

  const handleCancelPayment = () => {
    if (confirm("Anular o pagamento registado?")) setCancelPayment(true);
  };

  const handleDiscard = () => {
    if (rescheduledFrom) {
      onClose();
      return;
    }
    setEditTime(appt.time);
    setEditDate(appt.date);
    setEditServiceId(appt.serviceId);
    setEditDuration(originalDuration);
    setCash(appt.paymentCash != null ? String(appt.paymentCash) : "");
    setMbway(appt.paymentMbway != null ? String(appt.paymentMbway) : "");
    setCard(appt.paymentCard != null ? String(appt.paymentCard) : "");
    setTip("");
    setCancelPayment(false);
  };

  const btnRect = datePickerBtnRef.current?.getBoundingClientRect();
  const busy = isSaving || isNotifying || isSettingStatus;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Marcação"
        width="max-w-sm"
        footer={
          <div className="flex flex-col gap-3 w-full">
            {/* Blue banner — Reagendado */}
            {rescheduledFrom && (
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] dark:bg-accent/[0.08] px-3 py-2.5 flex items-start gap-2.5">
                <Icon
                  name="calendar"
                  className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-accent uppercase tracking-wide text-[10px]">
                    Reagendado
                  </p>
                  <p className="line-through text-zinc-400">
                    {format(parseISO(rescheduledFrom.date), "EEE d MMM", {
                      locale: pt,
                    })}{" "}
                    · {rescheduledFrom.time}
                  </p>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {format(parsedEditDate, "EEE d MMM", { locale: pt })} ·{" "}
                    {editTime}
                  </p>
                </div>
              </div>
            )}
            {/* Blue banner — Alterações manuais */}
            {!rescheduledFrom && detailsChanged && (
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] dark:bg-accent/[0.08] px-3 py-2.5 flex items-start gap-2.5">
                <Icon
                  name="edit"
                  className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                />
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold text-accent uppercase tracking-wide text-[10px]">
                    Alterações
                  </p>
                  {(editDate !== appt.date || editTime !== appt.time) && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {format(parseISO(appt.date), "EEE d MMM", {
                          locale: pt,
                        })}{" "}
                        · {appt.time}
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {format(parsedEditDate, "EEE d MMM", { locale: pt })} ·{" "}
                        {editTime}
                      </p>
                    </div>
                  )}
                  {editServiceId !== appt.serviceId && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {services.find((s) => s.serviceId === appt.serviceId)
                          ?.name ?? "—"}
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {svc?.name ?? "—"}
                      </p>
                    </div>
                  )}
                  {editDuration !== originalDuration && (
                    <div className="space-y-0.5">
                      <p className="line-through text-zinc-400">
                        {originalDuration} min
                      </p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {editDuration} min
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={hasChanges ? handleDiscard : onClose}
              >
                {hasChanges ? "Cancelar" : "Fechar"}
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                disabled={!hasChanges || busy}
                onClick={handleSave}
              >
                {isSaving && !isNotifying ? "A guardar…" : "Guardar"}
              </Button>
              {onSaveAndNotify && (
                <Button
                  disabled={!hasChanges || busy}
                  onClick={handleSaveAndNotify}
                >
                  {busy ? "A enviar…" : "Guardar e notificar"}
                </Button>
              )}
            </div>
            {/* Cancelar / Reativar — último de todos */}
            {status === "cancelled" ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isSettingStatus}
                  onClick={() => onSetStatus(appt.appointmentId, "confirmed")}
                >
                  {isSettingStatus ? "A reativar…" : "Reativar"}
                </Button>
                {onReactivateAndNotify && (
                  <Button
                    className="flex-1"
                    disabled={isSettingStatus}
                    onClick={() => onReactivateAndNotify(appt.appointmentId)}
                  >
                    {isSettingStatus ? "A reativar…" : "Reativar e notificar"}
                  </Button>
                )}
              </div>
            ) : status === "completed" ? null : confirmCancel ? (
              <Button
                variant="danger"
                className="w-full"
                disabled={isSettingStatus}
                onClick={() => onSetStatus(appt.appointmentId, "cancelled")}
              >
                {isSettingStatus ? "A cancelar…" : "Confirmar cancelamento"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-700"
                disabled={isSettingStatus}
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar marcação
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* ── Client header ── */}
          {onOpenCustomer ? (
            <button
              type="button"
              onClick={onOpenCustomer}
              className="group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 text-left border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition focus:outline-none focus:border-accent/40"
              style={{ borderLeft: `3px solid ${serviceColor}` }}
            >
              <div className="relative shrink-0">
                <Avatar name={appt.clientName} color={serviceColor} size={44} />
                {hasChanges && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900 dark:text-white truncate text-sm group-hover:text-accent transition-colors">
                  {appt.clientName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge tone={STATUS_TONE[status] as any} dot>
                    {STATUS_LABELS[status]}
                  </Badge>
                  {isPaid && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Icon name="euro" className="w-3 h-3" /> Pago
                    </span>
                  )}
                </div>
              </div>
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
              <div className="relative shrink-0">
                <Avatar name={appt.clientName} color={serviceColor} size={44} />
                {hasChanges && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900 dark:text-white truncate text-sm">
                  {appt.clientName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge tone={STATUS_TONE[status] as any} dot>
                    {STATUS_LABELS[status]}
                  </Badge>
                  {isPaid && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Icon name="euro" className="w-3 h-3" /> Pago
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            {(["details", "payment"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${tab === t ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                {t === "details" ? "Detalhes" : "Pagamento"}
              </button>
            ))}
          </div>

          {/* ── Details tab ── */}
          {tab === "details" && (
            <div className="space-y-3">
              {/* Date + time */}
              <div className="grid grid-cols-2 gap-2">
                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Hora</p>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                    />
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-[11px] text-zinc-400">Hora</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                      {appt.time}
                    </p>
                  </div>
                )}

                {canEdit ? (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Data</p>
                    <button
                      ref={datePickerBtnRef}
                      type="button"
                      onClick={() => setShowDatePicker((v) => !v)}
                      className="w-full flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 hover:border-accent focus:outline-none focus:border-accent transition-colors"
                    >
                      <Icon
                        name="calendar"
                        className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                      />
                      <span className="truncate">
                        {format(parsedEditDate, "dd MMM yyyy", { locale: pt })}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                    <p className="text-[11px] text-zinc-400">Data</p>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                      {appt.date}
                    </p>
                  </div>
                )}
              </div>

              {/* Service */}
              {canEdit ? (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Serviço</p>
                  <select
                    value={editServiceId}
                    onChange={(e) => setEditServiceId(e.target.value)}
                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                  >
                    {services
                      .filter((s) => s.active !== false)
                      .map((s) => (
                        <option key={s.serviceId} value={s.serviceId}>
                          {s.name} ({s.duration}min —{" "}
                          {Number(s.price).toFixed(2)}€)
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                  <p className="text-[11px] text-zinc-400">Serviço</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5 text-sm">
                    {svc?.name ?? "—"}
                  </p>
                </div>
              )}

              {/* Duration */}
              {canEdit && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Duração</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDuration((d) => Math.max(5, d - 5))}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-base leading-none shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={editDuration}
                      onChange={(e) =>
                        setEditDuration(
                          Math.max(5, Number(e.target.value) || 5),
                        )
                      }
                      className="w-16 text-center border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setEditDuration((d) => d + 5)}
                      className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-base leading-none shrink-0"
                    >
                      +
                    </button>
                    <span className="text-sm text-zinc-500">min</span>
                    {editDuration !== originalDuration && (
                      <span className="text-xs text-zinc-400 ml-auto">
                        padrão: {originalDuration}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                {appt.clientEmail && (
                  <div className="flex items-center gap-2">
                    <Icon
                      name="mail"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                    />
                    <span className="truncate">{appt.clientEmail}</span>
                  </div>
                )}
                {appt.clientPhone && (
                  <div className="flex items-center gap-2">
                    <Icon
                      name="phone"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                    />
                    <span>{appt.clientPhone}</span>
                  </div>
                )}
                {appt.notes && (
                  <div className="flex items-start gap-2">
                    <Icon
                      name="edit"
                      className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5"
                    />
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {appt.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Payment tab ── */}
          {tab === "payment" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm">
                <span className="text-zinc-500">{svc?.name ?? "Serviço"}</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {price.toFixed(2)} €
                </span>
              </div>

              {isPaid ? (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {appt.paymentCash != null &&
                      Number(appt.paymentCash) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Dinheiro</span>
                          <span className="font-medium">
                            {Number(appt.paymentCash).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    {appt.paymentMbway != null &&
                      Number(appt.paymentMbway) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">MBway</span>
                          <span className="font-medium">
                            {Number(appt.paymentMbway).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    {appt.paymentCard != null &&
                      Number(appt.paymentCard) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Cartão</span>
                          <span className="font-medium">
                            {Number(appt.paymentCard).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    {(() => {
                      const paidTotal =
                        Number(appt.paymentCash ?? 0) +
                        Number(appt.paymentMbway ?? 0) +
                        Number(appt.paymentCard ?? 0);
                      const paidTip = paidTotal - price;
                      return (
                        <>
                          {paidTip > 0.01 && (
                            <div className="flex justify-between text-zinc-500">
                              <span>Gorjeta</span>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {paidTip.toFixed(2)} €
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 font-semibold">
                            <span>Total recebido</span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {paidTotal.toFixed(2)} €
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Registado em{" "}
                    {new Date(appt.paidAt!).toLocaleDateString("pt-PT", {
                      dateStyle: "medium",
                    })}
                  </p>

                  {/* Editar pagamento */}
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["Dinheiro", cash, setCash],
                        ["MBway", mbway, setMbway],
                        ["Cartão", card, setCard],
                      ] as [string, string, (v: string) => void][]
                    ).map(([label, val, setter]) => (
                      <div key={label}>
                        <p className="text-xs text-zinc-500 mb-1">{label}</p>
                        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={val}
                            onChange={(e) => setter(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0"
                          />
                          <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">
                            €
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cancelPayment && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-2.5 py-2">
                      O pagamento será anulado quando guardares.
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={handleCancelPayment}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Anular pagamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["Dinheiro", cash, setCash],
                        ["MBway", mbway, setMbway],
                        ["Cartão", card, setCard],
                      ] as [string, string, (v: string) => void][]
                    ).map(([label, val, setter]) => (
                      <div key={label}>
                        <p className="text-xs text-zinc-500 mb-1">{label}</p>
                        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={val}
                            onChange={(e) => setter(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0"
                          />
                          <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">
                            €
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      Gorjeta{" "}
                      <span className="text-zinc-300 dark:text-zinc-600">
                        (opcional)
                      </span>
                    </p>
                    <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden w-28">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0"
                      />
                      <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">
                        €
                      </span>
                    </div>
                  </div>

                  {payTotal > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm font-medium px-1">
                        <span className="text-zinc-500">Total</span>
                        <span
                          className={
                            isExact
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isOver
                                ? "text-orange-500 dark:text-orange-400"
                                : "text-amber-500"
                          }
                        >
                          {payTotal.toFixed(2)} €{isExact && " ✓"}
                          {!isExact &&
                            !isOver &&
                            ` (faltam ${(price - payTotal).toFixed(2)} €)`}
                          {isOver &&
                            !tipVal &&
                            ` (+${(payTotal - price).toFixed(2)} € gorjeta)`}
                        </span>
                      </div>
                      {isOver && !tipVal && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-lg px-2.5 py-2">
                          <Icon
                            name="alertCircle"
                            className="w-3.5 h-3.5 shrink-0"
                          />
                          O valor excede o preço em{" "}
                          {(payTotal - price).toFixed(2)} €. Se for gorjeta, usa
                          o campo acima.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Date picker popup */}
      {showDatePicker && (
        <>
          <div
            className="fixed inset-0 z-[199]"
            onClick={() => setShowDatePicker(false)}
          />
          <div
            className="fixed z-[200] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64"
            style={{
              top: btnRect ? btnRect.bottom + 6 : 100,
              left: btnRect
                ? Math.min(btnRect.left, window.innerWidth - 268)
                : 100,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setPickerMonth((m) => subMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <Icon name="chevronLeft" className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium capitalize">
                {format(pickerMonth, "MMMM yyyy", { locale: pt })}
              </span>
              <button
                type="button"
                onClick={() => setPickerMonth((m) => addMonths(m, 1))}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <Icon name="chevronRight" className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES_SHORT.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-zinc-400 py-0.5"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {pickerGridDays.map((day) => {
                const isSelected = isSameDay(day, parsedEditDate);
                const inMonth = isSameMonth(day, pickerMonth);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setEditDate(format(day, "yyyy-MM-dd"));
                      setShowDatePicker(false);
                    }}
                    className={`h-7 w-full rounded text-xs font-medium transition
                      ${
                        isSelected
                          ? "bg-accent text-white"
                          : inMonth
                            ? "text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            : "text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
