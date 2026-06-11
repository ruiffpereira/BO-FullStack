import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { getApiError } from "../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../ui/icons.jsx";
import {
  Card,
  Button,
  IconButton,
  Badge,
  Avatar,
  Modal,
  Input,
  Select,
  PageHeader,
} from "../ui/ui.jsx";

import {
  useGetScheduleAppointments,
  getScheduleAppointmentsQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleAppointments.js";
import { usePostScheduleAppointmentsIdNotify } from "../gen/backoffice/hooks/usePostScheduleAppointmentsIdNotify.js";
import { postScheduleAppointmentsIdNotify } from "../gen/backoffice/hooks/usePostScheduleAppointmentsIdNotify.js";
import { putScheduleAppointmentsId } from "../gen/backoffice/hooks/usePutScheduleAppointmentsId.js";
import { usePostScheduleAppointments } from "../gen/backoffice/hooks/usePostScheduleAppointments.js";
import { usePutScheduleAppointmentsId } from "../gen/backoffice/hooks/usePutScheduleAppointmentsId.js";
import {
  useGetScheduleServices,
  getScheduleServicesQueryKey,
} from "../gen/backoffice/hooks/useGetScheduleServices.js";
import { usePostScheduleServices } from "../gen/backoffice/hooks/usePostScheduleServices.js";
import { usePutScheduleServicesId } from "../gen/backoffice/hooks/usePutScheduleServicesId.js";
import { useDeleteScheduleServicesId } from "../gen/backoffice/hooks/useDeleteScheduleServicesId.js";
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
import {
  useGetCustomers,
  getCustomersQueryKey,
} from "../gen/backoffice/hooks/useGetCustomers.js";
import { postCustomers } from "../gen/backoffice/hooks/usePostCustomers.js";
import { patchScheduleServicesReorder } from "../gen/backoffice/hooks/usePatchScheduleServicesReorder.js";
import { usePostScheduleBlockedSlotsVacation } from "../gen/backoffice/hooks/usePostScheduleBlockedSlotsVacation.js";
import {
  useGetCustomersIdHistory,
  getCustomersIdHistoryQueryKey,
} from "../gen/backoffice/hooks/useGetCustomersIdHistory.js";
import { patchCustomersId } from "../gen/backoffice/hooks/usePatchCustomersId.js";
import { useGetSettingsLanguages } from "../hooks/useSettingsLanguages";
import { useGetCmsSearch } from "../hooks/useCmsSearch";
import { toSlug } from "../utils/slug";
import { putCmsEntries } from "../gen/backoffice/hooks/usePutCmsEntries.js";
import { CmsTranslationsModal } from "../components/CmsTranslationsModal";

import type { Appointment } from "../gen/backoffice/types/Appointment.js";
import type { Service } from "../gen/backoffice/types/Service.js";
import type { WorkingHours } from "../gen/backoffice/types/WorkingHours.js";
import type { Customer } from "../gen/backoffice/types/Customer.js";
import {
  ApptModal,
  colorForService,
  STATUS_LABELS,
} from "../components/ApptModal.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const AG_H_START = 8;
const AG_H_END = 20;
const AG_ROW_H = 80;

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
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FULL_DAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
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

function workingHoursChanged(current: WorkingHours[], saved: WorkingHours[]) {
  return (
    JSON.stringify(normalizeWorkingHours(current)) !==
    JSON.stringify(normalizeWorkingHours(saved))
  );
}

function weekStartForDate(date: string | null) {
  if (!date) {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return new Date().getDay() === 0 ? addWeeks(ws, 1) : ws;
  }
  const day = new Date(date + "T00:00:00");
  return startOfWeek(day, { weekStartsOn: 1 });
}

function customerIdForAppointment(appt: Appointment, customers: Customer[]) {
  const runtimeId = (appt as Appointment & { customerId?: string | null })
    .customerId;
  if (runtimeId) return runtimeId;
  const email = appt.clientEmail?.toLowerCase();
  const phone = appt.clientPhone;
  return (
    customers.find(
      (c) =>
        (email && c.email?.toLowerCase() === email) ||
        (phone && c.contact === phone),
    )?.customerId ?? null
  );
}

function minuteToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// ─── Overlap layout ───────────────────────────────────────────────────────────
const MIN_VISUAL_MINS = Math.ceil((24 / AG_ROW_H) * 60);

function apptMinutes(appt: Appointment) {
  const [h, m] = appt.time.split(":").map(Number);
  return h * 60 + m;
}
function apptVisualEnd(appt: Appointment, services: Service[]) {
  const svc = services.find((s) => s.serviceId === appt.serviceId);
  return (
    apptMinutes(appt) +
    Math.max(appt.duration ?? svc?.duration ?? 30, MIN_VISUAL_MINS)
  );
}
function overlaps(a: Appointment, b: Appointment, services: Service[]) {
  return (
    apptMinutes(a) < apptVisualEnd(b, services) &&
    apptMinutes(b) < apptVisualEnd(a, services)
  );
}

function computeColumns(appts: Appointment[], services: Service[]) {
  const sorted = [...appts].sort((a, b) => apptMinutes(a) - apptMinutes(b));
  const result: { appt: Appointment; col: number; totalCols: number }[] = [];

  const groups: Appointment[][] = [];
  for (const appt of sorted) {
    const grp = groups.find((g) => g.some((x) => overlaps(x, appt, services)));
    if (grp) grp.push(appt);
    else groups.push([appt]);
  }

  for (const group of groups) {
    const cols: Appointment[][] = [];
    for (const appt of group) {
      let ci = cols.findIndex(
        (col) => !col.some((x) => overlaps(x, appt, services)),
      );
      if (ci === -1) {
        ci = cols.length;
        cols.push([]);
      }
      cols[ci].push(appt);
      result.push({ appt, col: ci, totalCols: 0 });
    }
    const n = cols.length;
    for (const r of result) {
      if (group.includes(r.appt)) r.totalCols = n;
    }
  }
  return result;
}

// ─── New appointment modal ────────────────────────────────────────────────────
function colorFromName(name: string) {
  const cols = [
    "#2A6FDB",
    "#1F8A5B",
    "#D97757",
    "#7C5CDB",
    "#E6B450",
    "#0EA5A4",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return cols[Math.abs(h) % cols.length];
}

type HistoryAppt = {
  appointmentId: string;
  serviceId: string;
  date: string;
  time: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes?: string | null;
  paymentCash?: number | null;
  paymentMbway?: number | null;
  paymentCard?: number | null;
  paidAt?: string | null;
  service?: { name: string; price: number };
};
type CustomerHistory = {
  customer: Customer;
  stats: {
    visitCount: number;
    totalSpent: number;
    lastVisit: string | null;
    favoriteServiceId: string | null;
  };
  appointments: HistoryAppt[];
};

const STATUS_PT: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  completed: "ConcluÃ­da",
  cancelled: "Cancelada",
};
const STATUS_TONE: Record<string, string> = {
  pending: "amber",
  confirmed: "green",
  completed: "green",
  cancelled: "red",
};

function CustomerProfileModal({
  customerId,
  customers,
  onClose,
  onOpenAppointment,
}: {
  customerId: string;
  customers: Customer[];
  onClose: () => void;
  onOpenAppointment: (appt: Appointment) => void;
}) {
  const qc = useQueryClient();
  const fallbackCustomer =
    customers.find((c) => c.customerId === customerId) ?? null;
  const { data: history, isLoading } =
    useGetCustomersIdHistory<CustomerHistory>(customerId);
  const customer = history?.customer ?? fallbackCustomer;
  const favoriteService = history?.appointments.find(
    (a) => a.service && a.serviceId === history.stats.favoriteServiceId,
  )?.service;

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      patchCustomersId(id, { blocked } as any),
    onSuccess: (_d, { blocked }) => {
      toast.success(blocked ? "Cliente bloqueado" : "Cliente desbloqueado");
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() });
      qc.invalidateQueries({
        queryKey: getCustomersIdHistoryQueryKey(customerId),
      });
    },
    onError: (e: any) => toast.error(getApiError(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Ficha de cliente"
      width="max-w-lg"
      footer={
        <>
          {customer && (
            <Button
              variant="outline"
              disabled={blockMut.isPending}
              onClick={() =>
                blockMut.mutate({
                  id: customer.customerId,
                  blocked: !customer.blocked,
                })
              }
              className={
                customer.blocked
                  ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  : "text-red-500 border-red-200 hover:bg-red-50"
              }
            >
              {blockMut.isPending
                ? "â€¦"
                : customer.blocked
                  ? "Desbloquear"
                  : "Bloquear"}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </>
      }
    >
      {!customer ? (
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar
              name={customer.name}
              color={colorFromName(customer.name)}
              size={56}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
                  {customer.name}
                </h3>
                {customer.blocked && (
                  <Badge tone="red">
                    <Icon name="ban" className="w-3 h-3 inline mr-0.5" />
                    Bloqueado
                  </Badge>
                )}
              </div>
              {customer.birthday && (
                <span className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                  <Icon name="star" className="w-3 h-3" />
                  {new Date(customer.birthday + "T00:00:00").toLocaleDateString(
                    "pt-PT",
                    { day: "numeric", month: "long" },
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            {customer.email && (
              <div className="flex items-center gap-2.5">
                <Icon name="mail" className="w-4 h-4 text-zinc-400" />
                {customer.email}
              </div>
            )}
            {customer.contact && (
              <div className="flex items-center gap-2.5">
                <Icon name="phone" className="w-4 h-4 text-zinc-400" />
                {customer.contact}
              </div>
            )}
            {customer.nif && (
              <div className="flex items-center gap-2.5">
                <Icon name="layers" className="w-4 h-4 text-zinc-400" />
                NIF {customer.nif}
              </div>
            )}
          </div>

          {customer.notes && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                Notas
              </p>
              {customer.notes}
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          )}

          {!isLoading && history && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {history.stats.visitCount}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">visitas</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {history.stats.totalSpent.toFixed(0)}â‚¬
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">gasto total</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                    {favoriteService?.name ?? "â€”"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    serviÃ§o favorito
                  </p>
                </div>
              </div>
              {history.stats.lastVisit && (
                <p className="text-xs text-zinc-400 text-center -mt-1">
                  Ãšltima visita:{" "}
                  {new Date(
                    history.stats.lastVisit + "T00:00:00",
                  ).toLocaleDateString("pt-PT", { dateStyle: "long" })}
                </p>
              )}

              {history.appointments.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    HistÃ³rico de marcaÃ§Ãµes
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {history.appointments.map((a) => {
                      const paid = a.paidAt
                        ? Number(a.paymentCash || 0) +
                          Number(a.paymentMbway || 0) +
                          Number(a.paymentCard || 0)
                        : null;
                      return (
                        <button
                          key={a.appointmentId}
                          onClick={() =>
                            onOpenAppointment(a as unknown as Appointment)
                          }
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-800 dark:text-zinc-100">
                              {a.date} Â· {a.time}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {a.service?.name ?? "â€”"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge
                              tone={(STATUS_TONE[a.status] as any) ?? "zinc"}
                            >
                              {STATUS_PT[a.status] ?? a.status}
                            </Badge>
                            {paid != null && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                {paid.toFixed(2)} â‚¬
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-2">
                  Sem marcaÃ§Ãµes registadas para este cliente.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function NovaApptModal({
  date,
  open,
  onClose,
  services,
  onCreate,
  isPending,
  initialTime,
}: {
  date: Date;
  open: boolean;
  onClose: () => void;
  services: Service[];
  onCreate: (data: any) => void;
  isPending: boolean;
  initialTime?: string;
}) {
  const qc = useQueryClient();

  const [editDate, setEditDate] = useState(format(date, "yyyy-MM-dd"));
  const [form, setForm] = useState({
    time: initialTime ?? "09:00",
    serviceId: "",
    notes: "",
  });
  const [q, setQ] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropListRef = useRef<HTMLDivElement>(null);
  const serviceSelectRef = useRef<HTMLSelectElement>(null);
  const [selCustomer, setSelCustomer] = useState<Customer | null>(null);
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", contact: "" });

  useEffect(() => {
    setEditDate(format(date, "yyyy-MM-dd"));
  }, [date]);
  useEffect(() => {
    if (initialTime) setForm((f) => ({ ...f, time: initialTime }));
  }, [initialTime]);

  const { data: custData, isError: custError } = useGetCustomers();
  const allCustomers = custData?.rows ?? [];

  const dropList = q.trim()
    ? allCustomers
        .filter((c) => {
          const ql = q.toLowerCase();
          return (
            (c.name ?? "").toLowerCase().includes(ql) ||
            (c.email ?? "").toLowerCase().includes(ql) ||
            (c.contact ?? "").includes(q)
          );
        })
        .slice(0, 6)
    : [];

  const createCustMut = useMutation({
    mutationFn: (data: { name: string; email: string; contact: string }) =>
      postCustomers(data as any),
    onSuccess: (c: Customer) => {
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() });
      selectCustomer(c);
      setShowNewCust(false);
      setNewCust({ name: "", email: "", contact: "" });
      toast.success("Cliente criado");
    },
    onError: (e: any) => toast.error(getApiError(e)),
  });

  const selectCustomer = (c: Customer) => {
    setSelCustomer(c);
    setQ("");
    setShowDrop(false);
    setTimeout(() => serviceSelectRef.current?.focus(), 50);
  };

  const deselectCustomer = () => {
    setSelCustomer(null);
  };

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNC = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNewCust((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDate) {
      toast.error("Seleciona uma data.");
      return;
    }
    if (!selCustomer) {
      toast.error("Seleciona um cliente.");
      return;
    }
    if (!form.serviceId) {
      toast.error("Seleciona um serviço.");
      return;
    }
    onCreate({
      time: form.time,
      serviceId: form.serviceId,
      notes: form.notes || undefined,
      date: editDate,
      customerId: selCustomer.customerId,
      clientName: selCustomer.name ?? "Cliente",
      clientEmail: selCustomer.email ?? "",
      clientPhone: selCustomer.contact ?? "",
    });
  };

  const handleCreateCust = () => {
    if (!newCust.name || !newCust.email || !newCust.contact) {
      toast.error("Nome, email e telefone obrigatórios");
      return;
    }
    createCustMut.mutate(newCust);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova marcação"
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="nova-appt-form" disabled={isPending}>
            {isPending ? "A guardar…" : "Criar marcação"}
          </Button>
        </>
      }
    >
      <form id="nova-appt-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Data *"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              label="Hora *"
              type="time"
              value={form.time}
              onChange={set("time")}
            />
          </div>
        </div>
        {/* ── Customer selector ── */}
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Cliente
          </p>
          {selCustomer ? (
            <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <Avatar
                name={selCustomer.name ?? "Cliente"}
                color={colorFromName(selCustomer.name ?? "Cliente")}
                size={28}
              />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                {selCustomer.name ?? "Cliente"}
              </span>
              <button
                type="button"
                onClick={deselectCustomer}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowDrop(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                onKeyDown={(e) => {
                  if (!showDrop || dropList.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((i) => {
                      const next = Math.min(i + 1, dropList.length - 1);
                      setTimeout(() => {
                        dropListRef.current?.children[next]?.scrollIntoView({
                          block: "nearest",
                        });
                      }, 0);
                      return next;
                    });
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((i) => {
                      const next = Math.max(i - 1, 0);
                      setTimeout(() => {
                        dropListRef.current?.children[next]?.scrollIntoView({
                          block: "nearest",
                        });
                      }, 0);
                      return next;
                    });
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const c = dropList[highlightedIndex];
                    if (c) selectCustomer(c);
                  } else if (e.key === "Escape") {
                    setShowDrop(false);
                  }
                }}
                placeholder="Procurar cliente existente…"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              {showDrop && q.trim() && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg mt-1 overflow-hidden">
                  {custError ? (
                    <p className="px-3 py-2 text-sm text-red-500">
                      Erro ao carregar clientes
                    </p>
                  ) : dropList.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-400">
                      Sem resultados
                    </p>
                  ) : (
                    <div ref={dropListRef}>
                      {dropList.map((c, idx) => (
                        <button
                          key={c.customerId}
                          type="button"
                          onMouseDown={() => selectCustomer(c)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${idx === highlightedIndex ? "bg-accent/[0.08] dark:bg-accent/[0.12]" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                        >
                          <Avatar
                            name={c.name ?? "Cliente"}
                            color={colorFromName(c.name ?? "Cliente")}
                            size={24}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
                              {c.name ?? "Cliente"}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {c.contact ?? c.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {!selCustomer && (
            <button
              type="button"
              onClick={() => setShowNewCust((v) => !v)}
              className="mt-1 text-xs text-accent hover:underline"
            >
              {showNewCust ? "− Cancelar" : "+ Criar novo cliente"}
            </button>
          )}
          {showNewCust && (
            <div className="mt-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 bg-zinc-50 dark:bg-zinc-800/40">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Novo cliente
              </p>
              <input
                value={newCust.name}
                onChange={setNC("name")}
                placeholder="Nome *"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              <input
                type="email"
                value={newCust.email}
                onChange={setNC("email")}
                placeholder="Email *"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              <input
                value={newCust.contact}
                onChange={setNC("contact")}
                placeholder="Telefone *"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={createCustMut.isPending}
                onClick={handleCreateCust}
              >
                {createCustMut.isPending ? "A criar…" : "Criar e selecionar"}
              </Button>
            </div>
          )}
        </div>

        <hr className="border-zinc-100 dark:border-zinc-800" />

        <label className="block">
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Serviço *
          </span>
          <div className="relative">
            <select
              ref={serviceSelectRef}
              value={form.serviceId}
              onChange={set("serviceId")}
              className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 pr-9 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
            >
              <option value="">Escolher serviço</option>
              {services
                .filter((s) => s.active !== false)
                .map((s) => (
                  <option key={s.serviceId} value={s.serviceId}>
                    {s.name} ({s.duration}min — {Number(s.price).toFixed(2)}€)
                  </option>
                ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              <Icon name="chevronDown" className="w-4 h-4" />
            </span>
          </div>
        </label>
        <Input
          label="Notas (opcional)"
          value={form.notes}
          onChange={set("notes")}
        />
      </form>
    </Modal>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────
type DragRef = {
  day: Date;
  colEl: HTMLElement;
  startMin: number;
  endMin: number;
  active: boolean;
  armed: boolean;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
};
type DragSel = { day: Date; startMin: number; endMin: number };
type DragAction = {
  x: number;
  y: number;
  pointerType: string;
  day: Date;
  startMin: number;
  endMin: number;
};

function CalendarioView() {
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
  const [rescheduledFrom, setRescheduledFrom] = useState<{
    date: string;
    time: string;
  } | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    appointmentId: string;
    newDate: string;
    newTime: string;
  } | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const notifyAfterSaveRef = useRef<string | null>(null);
  const notifyAfterReactivateRef = useRef<string | null>(null);
  const notifyContextRef = useRef<"save" | "reactivate">("save");
  const [novaDate, setNovaDate] = useState<Date | null>(null);
  const [novaTime, setNovaTime] = useState<string | null>(null);

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
  type ApptDragMeta = {
    appt: Appointment;
    offsetMin: number;
    grabYInGhost: number;
    ghostW: number;
    ghostH: number;
    active: boolean;
    armed: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    pointerId: number;
    pointerType: string;
    el: HTMLElement;
  };
  const apptDragMeta = useRef<ApptDragMeta | null>(null);
  const apptDragTargetRef = useRef<{ day: Date; min: number } | null>(null);
  const [apptDragState, setApptDragState] = useState<{
    appt: Appointment;
    mouseX: number;
    mouseY: number;
    grabYInGhost: number;
    ghostW: number;
    ghostH: number;
    targetDay: Date | null;
    targetMin: number | null;
  } | null>(null);
  const setApptDragStateRef = useRef(setApptDragState);
  const setSelApptRef = useRef(setSelAppt);
  const dayColRefs = useRef<Map<string, HTMLElement>>(new Map());

  const month = format(weekStart, "yyyy-MM");
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from(
    { length: AG_H_END - AG_H_START },
    (_, i) => AG_H_START + i,
  );

  const { data: appointments = [], isLoading } = useGetScheduleAppointments({
    month,
  });
  const { data: services = [] } = useGetScheduleServices();
  const { data: customersData } = useGetCustomers();
  const { data: blockedSlots = [] } = useGetScheduleBlockedSlots({ month });
  const { data: workingHours = [] } = useGetScheduleWorkingHours();
  const customers = customersData?.rows ?? [];

  const invalidateAppts = () =>
    qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
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
      onSuccess: () => {
        toast.success("Marcação criada");
        invalidateAppts();
        setNovaDate(null);
        setNovaTime(null);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const notifyAppt = usePostScheduleAppointmentsIdNotify({
    mutation: {
      onSuccess: () => {
        const ctx = notifyContextRef.current;
        notifyContextRef.current = "save";
        toast.success(
          ctx === "reactivate"
            ? "Marcação reativada e cliente notificado"
            : "Marcação guardada e cliente notificado",
        );
        setIsNotifying(false);
        setPendingReschedule(null);
        setRescheduledFrom(null);
        setSelAppt(null);
      },
      onError: (error) => {
        const ctx = notifyContextRef.current;
        notifyContextRef.current = "save";
        toast.success(
          ctx === "reactivate" ? "Marcação reativada" : "Marcação guardada",
        );
        toast.error(getApiError(error) || "Erro ao enviar email ao cliente");
        setIsNotifying(false);
        setPendingReschedule(null);
        setRescheduledFrom(null);
        setSelAppt(null);
      },
    },
  });

  const updateAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        invalidateAppts();
        const notifyId = notifyAfterSaveRef.current;
        if (notifyId) {
          notifyAfterSaveRef.current = null;
          setIsNotifying(true);
          notifyAppt.mutate({ id: notifyId });
        } else {
          toast.success("Marcação actualizada");
          setPendingReschedule(null);
          setRescheduledFrom(null);
          setSelAppt(null);
        }
      },
      onError: (error) => {
        notifyAfterSaveRef.current = null;
        toast.error(getApiError(error));
      },
    },
  });
  const lastStatusRef = useRef<string | null>(null);
  const setStatusAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: (_d, vars) => {
        invalidateAppts();
        const reactivateNotifyId = notifyAfterReactivateRef.current;
        if (reactivateNotifyId) {
          notifyAfterReactivateRef.current = null;
          notifyContextRef.current = "reactivate";
          setIsNotifying(true);
          notifyAppt.mutate({ id: reactivateNotifyId });
        } else {
          toast.success(
            lastStatusRef.current === "cancelled"
              ? "Marcação cancelada"
              : "Marcação reativada",
          );
          setPendingReschedule(null);
          setRescheduledFrom(null);
          setSelAppt(null);
        }
      },
      onError: (error) => {
        notifyAfterReactivateRef.current = null;
        toast.error(getApiError(error));
      },
    },
  });
  const cancelAndNotifyAppt = useMutation({
    mutationFn: async (id: string) => {
      await putScheduleAppointmentsId(id, { status: "cancelled" } as any);
      await postScheduleAppointmentsIdNotify(id);
    },
    onSuccess: () => {
      toast.success("Marcação cancelada e cliente notificado");
      invalidateAppts();
      setPendingReschedule(null);
      setRescheduledFrom(null);
      setSelAppt(null);
    },
    onError: (error) => {
      toast.success("Marcação cancelada");
      toast.error(getApiError(error) || "Erro ao enviar email ao cliente");
      invalidateAppts();
      setPendingReschedule(null);
      setRescheduledFrom(null);
      setSelAppt(null);
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

  // Global drag handlers (stable refs → no stale closure issues)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // ── Drag-to-create ──
      const d = dragRef.current;
      if (d && d.pointerId === e.pointerId) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.armed) {
          if (Math.sqrt(dx * dx + dy * dy) < 8) return;
          d.armed = true;
          d.active = true;
          document.body.style.touchAction = "none";
          setDragSelRef.current({
            day: d.day,
            startMin: d.startMin,
            endMin: d.endMin,
          });
        }
      }
      if (d && d.active && d.pointerId === e.pointerId) {
        e.preventDefault();
        const rect = d.colEl.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        const totalMin = (y / AG_ROW_H) * 60 + AG_H_START * 60;
        const snapped = Math.min(
          Math.max(Math.round(totalMin / 15) * 15, AG_H_START * 60),
          AG_H_END * 60,
        );
        d.endMin = snapped;
        const startMin = Math.min(d.startMin, d.endMin);
        const endMin = Math.max(d.startMin, d.endMin);
        setDragSelRef.current({ day: d.day, startMin, endMin });
        return;
      }
      // ── Appointment reschedule drag ──
      const ad = apptDragMeta.current;
      if (!ad || !ad.active || ad.pointerId !== e.pointerId) return;
      const dx = e.clientX - ad.startX;
      const dy = e.clientY - ad.startY;
      if (!ad.armed) {
        if (Math.sqrt(dx * dx + dy * dy) < 8) return;
        ad.armed = true;
        document.body.style.touchAction = "none";
      }
      e.preventDefault();
      if (!ad.moved && Math.sqrt(dx * dx + dy * dy) > 5) {
        ad.moved = true;
        document.body.style.cursor = "grabbing";
        setApptDragStateRef.current({
          appt: ad.appt,
          mouseX: e.clientX,
          mouseY: e.clientY,
          grabYInGhost: ad.grabYInGhost,
          ghostW: ad.ghostW,
          ghostH: ad.ghostH,
          targetDay: null,
          targetMin: null,
        });
        return;
      }
      if (!ad.moved) return;
      let targetDay: Date | null = null;
      let targetMin: number | null = null;
      for (const [dayStr, el] of dayColRefs.current) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) {
          targetDay = new Date(dayStr + "T00:00:00");
          const rawMin =
            ((e.clientY - r.top - ad.grabYInGhost) / AG_ROW_H) * 60 +
            AG_H_START * 60;
          targetMin = Math.min(
            Math.max(Math.round(rawMin / 15) * 15, AG_H_START * 60),
            (AG_H_END - 1) * 60,
          );
          break;
        }
      }
      apptDragTargetRef.current =
        targetDay && targetMin !== null
          ? { day: targetDay, min: targetMin }
          : null;
      setApptDragStateRef.current((prev) =>
        prev
          ? {
              ...prev,
              mouseX: e.clientX,
              mouseY: e.clientY,
              targetDay,
              targetMin,
            }
          : null,
      );
    };

    const onUp = (e: PointerEvent) => {
      // ── Drag-to-create ──
      const d = dragRef.current;
      if (d && d.pointerId === e.pointerId) {
        if (d.colEl.hasPointerCapture(e.pointerId)) {
          d.colEl.releasePointerCapture(e.pointerId);
        }
        if (!d.armed) {
          dragRef.current = null;
          document.body.style.touchAction = "";
          setNovaDateRef.current(d.day);
          setNovaTimeRef.current(minuteToTime(d.startMin));
          return;
        }
        d.active = false;
        const startMin = Math.min(d.startMin, d.endMin);
        const endMin = Math.max(d.startMin, d.endMin);
        const day = d.day;
        dragRef.current = null;
        setDragSelRef.current(null);
        document.body.style.touchAction = "";
        if (endMin - startMin >= 15) {
          setDragActionRef.current({
            x: e.clientX,
            y: e.clientY,
            pointerType: d.pointerType,
            day,
            startMin,
            endMin,
          });
        } else {
          setNovaDateRef.current(day);
          setNovaTimeRef.current(minuteToTime(startMin));
        }
        return;
      }
      // ── Appointment reschedule drag ──
      const ad = apptDragMeta.current;
      if (!ad || !ad.active || ad.pointerId !== e.pointerId) return;
      if (ad.el.hasPointerCapture(e.pointerId)) {
        ad.el.releasePointerCapture(e.pointerId);
      }
      ad.active = false;
      apptDragMeta.current = null;
      document.body.style.cursor = "";
      document.body.style.touchAction = "";
      setApptDragStateRef.current(null);
      const target = apptDragTargetRef.current;
      apptDragTargetRef.current = null;
      if (ad.moved && target) {
        const newDate = format(target.day, "yyyy-MM-dd");
        const newTime = minuteToTime(target.min);
        if (newDate !== ad.appt.date || newTime !== ad.appt.time) {
          // Don't save yet — open modal for confirmation
          setPendingReschedule({
            appointmentId: ad.appt.appointmentId,
            newDate,
            newTime,
          });
          setRescheduledFrom({ date: ad.appt.date, time: ad.appt.time });
          setSelApptRef.current(ad.appt);
        }
      } else if (!ad.moved) {
        setSelApptRef.current(ad.appt);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.touchAction = "";
    };
  }, []);

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
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">
      <Card
        className="overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 17.5rem)", minHeight: 480 }}
      >
        {/* ── Navegação ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0 relative">
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevronLeft"
              label="Semana anterior"
              onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
                setWeekStart(new Date().getDay() === 0 ? addWeeks(ws, 1) : ws);
              }}
            >
              Hoje
            </Button>
            <IconButton
              icon="chevronRight"
              label="Próxima semana"
              onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            />
          </div>
          <button
            ref={miniCalBtnRef}
            onClick={() => {
              setMiniCalMonth(startOfMonth(weekStart));
              setShowMiniCal((v) => !v);
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize hover:text-accent transition px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {format(weekStart, "MMMM yyyy", { locale: pt })}
            <Icon
              name="chevronDown"
              className={`w-3.5 h-3.5 transition-transform ${showMiniCal ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* ── Mini calendar popup ── */}
        {showMiniCal && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMiniCal(false)}
            />
            <div
              className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-64"
              style={(() => {
                const btn = miniCalBtnRef.current;
                if (!btn) return { top: 100, right: 24 };
                const r = btn.getBoundingClientRect();
                return { top: r.bottom + 6, left: r.right - 256 };
              })()}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setMiniCalMonth((m) => subMonths(m, 1))}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                >
                  <Icon name="chevronLeft" className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
                  {format(miniCalMonth, "MMMM yyyy", { locale: pt })}
                </span>
                <button
                  onClick={() => setMiniCalMonth((m) => addMonths(m, 1))}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                >
                  <Icon name="chevronRight" className="w-4 h-4" />
                </button>
              </div>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-medium text-zinc-400 py-0.5"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Day grid */}
              {(() => {
                const monthStart = miniCalMonth;
                const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                const gridEnd = addDays(gridStart, 41);
                const gridDays = eachDayOfInterval({
                  start: gridStart,
                  end: gridEnd,
                });
                const today = new Date();
                return (
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {gridDays.map((day) => {
                      const isToday = isSameDay(day, today);
                      const isCurrentWeek = days.some((d) => isSameDay(d, day));
                      const inMonth = isSameMonth(day, miniCalMonth);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => {
                            setWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                            setShowMiniCal(false);
                          }}
                          className={`text-xs rounded py-1 font-medium transition
                            ${isCurrentWeek ? "bg-accent text-white" : ""}
                            ${isToday && !isCurrentWeek ? "text-accent font-bold" : ""}
                            ${!inMonth ? "text-zinc-300 dark:text-zinc-600" : !isCurrentWeek ? "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}
                          `}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* ── Área com scroll ── */}
        <div className="overflow-auto flex-1 min-h-0">
          <div className="min-w-[600px]">
            {/* cabeçalho dos dias — sticky */}
            <div
              className="grid sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800"
              style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}
            >
              <div />
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={`px-2 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/50 ${isToday ? "bg-accent/[0.06] dark:bg-accent/[0.10]" : ""}`}
                  >
                    <p
                      className={`text-xs uppercase tracking-wide ${isToday ? "text-accent font-semibold" : "text-zinc-400"}`}
                    >
                      {DAY_NAMES[day.getDay()]}
                    </p>
                    <div className="flex justify-center mt-0.5">
                      <span
                        className={`text-lg font-semibold leading-none w-8 h-8 flex items-center justify-center rounded-full ${isToday ? "bg-accent text-white" : "text-zinc-800 dark:text-zinc-100"}`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* grelha de horas */}
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `48px repeat(6, 1fr)` }}
            >
              <div>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-right pr-2 text-[10px] text-zinc-400 tabular-nums"
                    style={{ height: AG_ROW_H }}
                  >
                    <span className="-translate-y-2 inline-block">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
                {/* End-time cap label */}
                <div
                  className="text-right pr-2 text-[10px] text-zinc-400 tabular-nums"
                  style={{ height: 0 }}
                >
                  <span className="-translate-y-2 inline-block">
                    {String(AG_H_END).padStart(2, "0")}:00
                  </span>
                </div>
              </div>
              {days.map((day) => {
                const isToday = isSameDay(day, new Date());
                const dayDateStr = format(day, "yyyy-MM-dd");
                const dayAppts = (appointments as Appointment[]).filter((a) => {
                  const effectiveDate =
                    pendingReschedule?.appointmentId === a.appointmentId
                      ? pendingReschedule.newDate
                      : a.date;
                  return (
                    effectiveDate === dayDateStr && a.status !== "cancelled"
                  );
                });
                const effectiveAppts = dayAppts.map((a) =>
                  pendingReschedule?.appointmentId === a.appointmentId
                    ? {
                        ...a,
                        date: pendingReschedule.newDate,
                        time: pendingReschedule.newTime,
                      }
                    : a,
                );
                const layout = computeColumns(effectiveAppts, services);
                const dayBlocked = blockedSlots.filter((bs) =>
                  isSameDay(new Date((bs as any).date + "T00:00:00"), day),
                );
                const hasDragSel = dragSel && isSameDay(dragSel.day, day);

                return (
                  <div
                    key={day.toISOString()}
                    ref={(el) => {
                      if (el)
                        dayColRefs.current.set(format(day, "yyyy-MM-dd"), el);
                      else dayColRefs.current.delete(format(day, "yyyy-MM-dd"));
                    }}
                    className={`relative border-l border-zinc-50 dark:border-zinc-800/50 cursor-crosshair select-none ${isToday ? "bg-accent/[0.04] dark:bg-accent/[0.07]" : ""}`}
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = Math.max(0, e.clientY - rect.top);
                      const totalMin = (y / AG_ROW_H) * 60 + AG_H_START * 60;
                      const snapped = Math.round(totalMin / 15) * 15;
                      const isTouch = e.pointerType === "touch";
                      dragRef.current = {
                        day,
                        colEl: e.currentTarget,
                        startMin: snapped,
                        endMin: snapped,
                        active: !isTouch,
                        armed: !isTouch,
                        pointerId: e.pointerId,
                        pointerType: e.pointerType,
                        startX: e.clientX,
                        startY: e.clientY,
                      };
                      if (!isTouch) {
                        document.body.style.touchAction = "none";
                        setDragSel({ day, startMin: snapped, endMin: snapped });
                      }
                    }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-b border-zinc-50 dark:border-zinc-800/40"
                        style={{ height: AG_ROW_H }}
                      />
                    ))}

                    {/* Blocked slots overlay */}
                    {dayBlocked.map((bs: any) => {
                      if (!bs.startTime || !bs.endTime) {
                        return (
                          <div
                            key={bs.blockedSlotId}
                            className="absolute inset-0 bg-zinc-400/8 dark:bg-zinc-600/15 border-l-2 border-zinc-300 dark:border-zinc-600 pointer-events-none z-[5]"
                          />
                        );
                      }
                      const [sh, sm] = bs.startTime.split(":").map(Number);
                      const [eh, em] = bs.endTime.split(":").map(Number);
                      const startMinBs = sh * 60 + sm;
                      const endMinBs = eh * 60 + em;
                      const top =
                        ((startMinBs - AG_H_START * 60) / 60) * AG_ROW_H;
                      const height = ((endMinBs - startMinBs) / 60) * AG_ROW_H;
                      return (
                        <div
                          key={bs.blockedSlotId}
                          className="absolute inset-x-0 bg-zinc-400/12 dark:bg-zinc-600/20 border-l-2 border-zinc-300 dark:border-zinc-600 pointer-events-none z-[5]"
                          style={{
                            top: Math.max(top, 0),
                            height: Math.max(height, 4),
                          }}
                        />
                      );
                    })}

                    {/* Lunch break overlay */}
                    {(() => {
                      const wh = workingHours.find(
                        (h) => h.dayOfWeek === day.getDay(),
                      );
                      if (!wh?.lunchStart || !wh?.lunchEnd) return null;
                      const [sh, sm] = wh.lunchStart.split(":").map(Number);
                      const [eh, em] = wh.lunchEnd.split(":").map(Number);
                      const startMin = sh * 60 + sm;
                      const endMin = eh * 60 + em;
                      const top =
                        ((startMin - AG_H_START * 60) / 60) * AG_ROW_H;
                      const height = ((endMin - startMin) / 60) * AG_ROW_H;
                      return (
                        <div
                          className="absolute inset-x-0 bg-amber-400/10 dark:bg-amber-500/15 border-l-2 border-amber-300 dark:border-amber-500/40 pointer-events-none z-[5] flex items-center"
                          style={{
                            top: Math.max(top, 0),
                            height: Math.max(height, 8),
                          }}
                        >
                          <span className="text-[9px] font-medium text-amber-500/60 dark:text-amber-400/50 pl-1.5 leading-none select-none">
                            Almoço
                          </span>
                        </div>
                      );
                    })()}

                    {/* Drag selection highlight */}
                    {hasDragSel &&
                      (() => {
                        const top =
                          ((dragSel!.startMin - AG_H_START * 60) / 60) *
                          AG_ROW_H;
                        const height =
                          ((dragSel!.endMin - dragSel!.startMin) / 60) *
                          AG_ROW_H;
                        return (
                          <div
                            className="absolute inset-x-0 bg-blue-500/20 border border-blue-400 dark:border-blue-500 rounded pointer-events-none z-[6]"
                            style={{ top, height: Math.max(height, 2) }}
                          />
                        );
                      })()}

                    {/* Reschedule drop indicator */}
                    {apptDragState?.targetDay &&
                      isSameDay(apptDragState.targetDay, day) &&
                      apptDragState.targetMin !== null &&
                      (() => {
                        const da = apptDragState.appt;
                        const svc = services.find(
                          (s) => s.serviceId === da.serviceId,
                        );
                        const dur = da.duration ?? svc?.duration ?? 30;
                        const top =
                          ((apptDragState.targetMin! - AG_H_START * 60) / 60) *
                          AG_ROW_H;
                        const height = (dur / 60) * AG_ROW_H - 4;
                        const color = colorForService(da.serviceId, services);
                        return (
                          <div
                            className="absolute inset-x-1 rounded-lg pointer-events-none z-[8]"
                            style={{
                              top,
                              height: Math.max(height, 20),
                              background: `${color}20`,
                              borderLeft: `3px solid ${color}`,
                              border: `1px solid ${color}60`,
                            }}
                          />
                        );
                      })()}

                    {/* Appointments */}
                    {isLoading ? (
                      <div className="absolute inset-2 top-2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 h-10" />
                    ) : (
                      layout.map(({ appt, col, totalCols }) => {
                        const svcItem = services.find(
                          (s) => s.serviceId === appt.serviceId,
                        );
                        const color = colorForService(appt.serviceId, services);
                        const [hh, mm] = appt.time.split(":").map(Number);
                        const top = (hh + mm / 60 - AG_H_START) * AG_ROW_H;
                        const height =
                          ((appt.duration ?? svcItem?.duration ?? 30) / 60) *
                            AG_ROW_H -
                          4;
                        const leftPct = (col / totalCols) * 100;
                        const widthPct = (1 / totalCols) * 100;
                        const isBeingDragged =
                          apptDragState?.appt.appointmentId ===
                          appt.appointmentId;
                        return (
                          <button
                            key={appt.appointmentId}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (e.button !== 0) return;
                              e.preventDefault();
                              e.currentTarget.setPointerCapture(e.pointerId);
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const yInAppt = Math.max(0, e.clientY - rect.top);
                              const isTouch = e.pointerType === "touch";
                              apptDragMeta.current = {
                                appt,
                                offsetMin: Math.round(
                                  (yInAppt / AG_ROW_H) * 60,
                                ),
                                grabYInGhost: yInAppt,
                                ghostW: rect.width,
                                ghostH: rect.height,
                                active: true,
                                armed: !isTouch,
                                moved: false,
                                startX: e.clientX,
                                startY: e.clientY,
                                pointerId: e.pointerId,
                                pointerType: e.pointerType,
                                el: e.currentTarget,
                              };
                              if (!isTouch)
                                document.body.style.touchAction = "none";
                            }}
                            className={`absolute group rounded-lg px-2 py-1 text-left z-10 hover:shadow-md hover:z-20 transition-all cursor-grab active:cursor-grabbing ${isBeingDragged ? "opacity-25" : ""}`}
                            style={{
                              top: top + 2,
                              height: Math.max(height, 24),
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              background: `${color}18`,
                              borderLeft: `3px solid ${color}`,
                              border: `1px solid ${color}30`,
                              touchAction: "none",
                            }}
                          >
                            <p className="text-[10px] font-semibold leading-tight truncate text-zinc-800 dark:text-zinc-100 pr-4">
                              {appt.time} {appt.clientName}
                              {appt.paidAt && (
                                <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                  €
                                </span>
                              )}
                            </p>
                            {svcItem && (
                              <p className="text-[9px] text-zinc-500 truncate">
                                {svcItem.name}
                              </p>
                            )}
                            <span
                              title="Nova marcação à mesma hora"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setNovaDate(day);
                                setNovaTime(appt.time);
                              }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 sm:w-4 sm:h-4 flex items-center justify-center rounded text-[12px] sm:text-[11px] font-bold opacity-80 sm:opacity-0 sm:group-hover:opacity-80 hover:!opacity-100 transition-opacity bg-white/80 dark:bg-zinc-900/80 text-zinc-500 hover:text-accent cursor-pointer"
                            >
                              +
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 ">
        <Card className="p-4">
          <Button
            className="w-full"
            icon="plus"
            onClick={() => {
              setNovaDate(new Date());
              setNovaTime(null);
            }}
          >
            Nova marcação
          </Button>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2 mb-3">
            <Icon name="calendar" className="w-4 h-4 text-accent" />
            Próximas vagas
            {upcoming.length > 0 && (
              <Badge tone="blue">{upcoming.length}</Badge>
            )}
          </h3>
          <div className="space-y-1 overflow-y-auto xl:max-h-[calc(100vh-17.5rem)]">
            {upcoming.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem vagas futuras.</p>
            ) : (
              upcoming.map((a) => {
                const svc = services.find((s) => s.serviceId === a.serviceId);
                const color = colorForService(a.serviceId, services);
                const isToday = a.date === today;
                return (
                  <button
                    key={a.appointmentId}
                    onClick={() => setSelAppt(a)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left transition-colors"
                  >
                    <span
                      className="w-1 h-8 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                        {a.clientName}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {isToday ? "Hoje" : a.date} · {a.time}
                        {svc ? ` · ${svc.name}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Drag action popup */}
      {dragAction && (
        <>
          <div
            className="fixed inset-0 z-40"
            onPointerDown={() => setDragAction(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 min-w-[210px]"
            style={
              dragAction.pointerType === "touch"
                ? { left: 16, right: 16, bottom: 16 }
                : {
                    left: Math.min(dragAction.x + 8, window.innerWidth - 230),
                    top: Math.min(dragAction.y - 10, window.innerHeight - 140),
                  }
            }
          >
            <p className="text-xs text-zinc-400 px-2 py-1 mb-1 font-medium">
              {minuteToTime(dragAction.startMin)} —{" "}
              {minuteToTime(dragAction.endMin)}
            </p>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setNovaDate(dragAction.day);
                setNovaTime(minuteToTime(dragAction.startMin));
                setDragAction(null);
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-800 dark:text-zinc-100"
            >
              <Icon name="plus" className="w-4 h-4 text-accent" /> Nova marcação
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                blockSlot.mutate({
                  data: {
                    date: format(dragAction.day, "yyyy-MM-dd"),
                    startTime: minuteToTime(dragAction.startMin),
                    endTime: minuteToTime(dragAction.endMin),
                  },
                });
                setDragAction(null);
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-800 dark:text-zinc-100"
            >
              <Icon name="ban" className="w-4 h-4 text-red-400" /> Bloquear
              horário
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setDragAction(null)}
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Appointment drag ghost */}
      {apptDragState &&
        (() => {
          const {
            appt: da,
            mouseX,
            mouseY,
            grabYInGhost,
            ghostW,
            ghostH,
            targetMin,
          } = apptDragState;
          const color = colorForService(da.serviceId, services);
          const svcItem = services.find((s) => s.serviceId === da.serviceId);
          return (
            <div
              className="fixed pointer-events-none z-[100] rounded-lg px-2 py-1 shadow-xl"
              style={{
                left: mouseX - ghostW / 2,
                top: mouseY - grabYInGhost,
                width: ghostW,
                height: Math.max(ghostH, 24),
                background: `${color}22`,
                borderLeft: `3px solid ${color}`,
                border: `1px solid ${color}60`,
                opacity: 0.9,
              }}
            >
              <p className="text-[10px] font-semibold leading-tight truncate text-zinc-800 dark:text-zinc-100">
                {targetMin !== null ? minuteToTime(targetMin) : da.time}{" "}
                {da.clientName}
              </p>
              {svcItem && (
                <p className="text-[9px] text-zinc-500 truncate">
                  {svcItem.name}
                </p>
              )}
            </div>
          );
        })()}

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
          onSaveAndNotify={(id, data) => {
            notifyContextRef.current = "save";
            notifyAfterSaveRef.current = id;
            updateAppt.mutate({ id, data });
          }}
          onReactivateAndNotify={(id, data) => {
            notifyAfterReactivateRef.current = id;
            lastStatusRef.current = "confirmed";
            setStatusAppt.mutate({
              id,
              data: { status: "confirmed", ...data },
            });
          }}
          onCancelAndNotify={(id) => cancelAndNotifyAppt.mutate(id)}
          isNotifying={isNotifying}
          isSaving={updateAppt.isPending}
          isSettingStatus={
            setStatusAppt.isPending || cancelAndNotifyAppt.isPending
          }
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

// ─── CMS combo (service) ──────────────────────────────────────────────────────
function CmsComboService({
  value,
  onChange,
  defaultLang,
  label = "CMS (opcional)",
}: {
  value: string | null;
  onChange: (key: string | null, label?: string) => void;
  defaultLang: string;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [cachedLabel, setCachedLabel] = useState<string>("");
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useGetCmsSearch(
    { q: q || undefined, context: "service", lang: defaultLang },
    { query: { enabled: open } },
  );

  const selected = value
    ? (results.find((r) => r.key === value) ?? {
        key: value,
        label: cachedLabel || value,
        sectionName: null,
      })
    : null;

  const handleCreate = async () => {
    if (!createName.trim()) return;
    const key = `service.${toSlug(createName)}`;
    setSaving(true);
    try {
      await putCmsEntries({
        key,
        locale: defaultLang,
        value: createName,
        type: "text",
      });
      toast.success("Entrada criada no CMS");
      setCachedLabel(createName);
      onChange(key, createName);
      setCreating(false);
      setCreateName("");
    } catch {
      toast.error("Erro ao criar entrada CMS");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        {label}
      </label>
      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              } else if (e.key === "Escape") {
                setCreating(false);
                setCreateName("");
              }
            }}
            placeholder="Nome da entrada…"
            className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="px-3 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "…" : "Criar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setCreateName("");
            }}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      ) : selected ? (
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTranslatingKey(value)}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors min-w-0"
          >
            <Icon name="layers" className="w-4 h-4 text-accent shrink-0" />
            <p className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
              {selected.label}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setCachedLabel("");
              onChange(null);
            }}
            className="px-3 py-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none border-l border-zinc-200 dark:border-zinc-700"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHighlighted(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            onKeyDown={(e) => {
              const list = results;
              if (!open) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlighted((i) => Math.min(i + 1, list.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlighted((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (highlighted === list.length) {
                  setCreating(true);
                  setCreateName(q);
                  setOpen(false);
                  setQ("");
                } else if (list[highlighted]) {
                  setCachedLabel(list[highlighted].label ?? "");
                  onChange(
                    list[highlighted].key ?? null,
                    list[highlighted].label ?? undefined,
                  );
                  setQ("");
                  setOpen(false);
                }
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Pesquisar entrada CMS…"
            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
          />
          {open && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
              <div ref={dropRef} className="max-h-52 overflow-y-auto">
                {isFetching && results.length === 0 && (
                  <p className="px-3 py-2.5 text-sm text-zinc-400">
                    A pesquisar…
                  </p>
                )}
                {!isFetching && results.length === 0 && q && (
                  <p className="px-3 py-2 text-xs text-zinc-400">
                    Sem resultados para "{q}".
                  </p>
                )}
                {results.map((r, idx) => (
                  <button
                    key={r.key}
                    type="button"
                    onMouseDown={() => {
                      setCachedLabel(r.label ?? "");
                      onChange(r.key ?? null, r.label ?? undefined);
                      setQ("");
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlighted(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${highlighted === idx ? "bg-accent/[0.08] dark:bg-accent/[0.12]" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                  >
                    <Icon
                      name="layers"
                      className="w-3.5 h-3.5 text-accent/70 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
                        {r.label}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {r.key}
                        {r.sectionName ? ` · ${r.sectionName}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onMouseDown={() => {
                  setCreating(true);
                  setCreateName(q);
                  setOpen(false);
                  setQ("");
                }}
                onMouseEnter={() => setHighlighted(results.length)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-t border-zinc-100 dark:border-zinc-800 ${highlighted === results.length ? "bg-accent/[0.08] text-accent" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
                Criar entrada no CMS
              </button>
            </div>
          )}
        </div>
      )}
      {translatingKey && (
        <CmsTranslationsModal
          cmsKey={translatingKey}
          defaultLang={defaultLang}
          onClose={() => setTranslatingKey(null)}
        />
      )}
    </div>
  );
}

// ─── Services panel ───────────────────────────────────────────────────────────
type SvcForm = {
  name: string;
  duration: string;
  price: string;
  description: string;
  active: boolean;
  color: string;
  contentKey: string | null;
  descriptionKey: string | null;
};
const emptySvcForm: SvcForm = {
  name: "",
  duration: "30",
  price: "",
  description: "",
  active: true,
  color: "#2A6FDB",
  contentKey: null,
  descriptionKey: null,
};

function ServicosPanel() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<SvcForm>(emptySvcForm);
  const { data: langData } = useGetSettingsLanguages();
  const defaultLang = langData?.default ?? "pt";
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const dragIndexRef = useRef<number | null>(null);

  const { data: services = [], isLoading } = useGetScheduleServices();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getScheduleServicesQueryKey() });

  useEffect(() => {
    if (services.length) setLocalOrder(services.map((s) => s.serviceId));
  }, [services]);

  const orderedServices = localOrder
    .map((id) => services.find((s) => s.serviceId === id))
    .filter((s): s is Service => !!s);

  const reorder = useMutation({
    mutationFn: (order: string[]) =>
      patchScheduleServicesReorder({ order } as any),
    onSuccess: () => invalidate(),
    onError: () => {
      toast.error("Erro ao reordenar");
      setLocalOrder(services.map((s) => s.serviceId));
    },
  });

  const create = usePostScheduleServices({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço criado");
        invalidate();
        qc.invalidateQueries({ queryKey: ["cms-references-counts"] });
        setModal(false);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const update = usePutScheduleServicesId({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço actualizado");
        invalidate();
        qc.invalidateQueries({ queryKey: ["cms-references-counts"] });
        setModal(false);
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const remove = useDeleteScheduleServicesId({
    mutation: {
      onSuccess: () => {
        toast.success("Serviço eliminado");
        invalidate();
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });

  const openEdit = useCallback((s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      duration: String(s.duration),
      price: String(s.price),
      description: s.description ?? "",
      active: s.active ?? true,
      color: s.color ?? "#2A6FDB",
      contentKey: s.contentKey ?? null,
      descriptionKey: (s as any).descriptionKey ?? null,
    });
    setModal(true);
  }, []);

  useEffect(() => {
    const id = searchParams.get("openService");
    if (!id || services.length === 0) return;
    const svc = services.find((s) => s.serviceId === id);
    if (svc) {
      openEdit(svc);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, services, openEdit, setSearchParams]);

  const handleSave = () => {
    if (!form.contentKey) {
      toast.error("Seleciona uma entrada CMS para o nome do serviço");
      return;
    }
    const data = {
      name: form.name,
      duration: parseInt(form.duration),
      price: parseFloat(form.price),
      description: form.description || undefined,
      active: form.active,
      color: form.color,
      contentKey: form.contentKey,
      descriptionKey: form.descriptionKey,
    };
    if (editing) update.mutate({ id: editing.serviceId, data: data as any });
    else create.mutate({ data: data as any });
  };

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    const next = [...localOrder];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setLocalOrder(next);
    dragIndexRef.current = index;
  };
  const handleDrop = () => {
    reorder.mutate(localOrder);
    dragIndexRef.current = null;
  };
  const handleDragEnd = () => {
    dragIndexRef.current = null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {services.length} serviços · arrasta para reordenar
        </p>
        <Button
          icon="plus"
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm(emptySvcForm);
            setFormKey((k) => k + 1);
            setModal(true);
          }}
        >
          Novo serviço
        </Button>
      </div>
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
          />
        ))
      ) : services.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400">
          Ainda não há serviços.
        </Card>
      ) : (
        <div className="space-y-2">
          {orderedServices.map((s, i) => (
            <Card
              key={s.serviceId}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e: React.DragEvent) => handleDragOver(e, i)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`p-4 flex items-center gap-3 select-none ${!s.active ? "opacity-50" : ""}`}
            >
              <Icon
                name="grip"
                className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 cursor-grab active:cursor-grabbing"
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: s.color ?? stableColorForId(s.serviceId) }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white text-sm">
                  {s.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {s.duration} min · {Number(s.price).toFixed(2)}€
                  {s.description ? ` · ${s.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    update.mutate(
                      { id: s.serviceId, data: { active: !s.active } },
                      { onSuccess: invalidate },
                    )
                  }
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5"
                >
                  <Icon name={s.active ? "check" : "ban"} className="w-4 h-4" />
                </button>
                <IconButton
                  icon="edit"
                  label="Editar"
                  onClick={() => openEdit(s)}
                />
                <IconButton
                  icon="trash"
                  label="Eliminar"
                  onClick={() =>
                    confirm(`Eliminar "${s.name}"?`) &&
                    remove.mutate({ id: s.serviceId })
                  }
                  className="hover:text-red-500"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Editar serviço" : "Novo serviço"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
            >
              {create.isPending || update.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <CmsComboService
            key={`name-${editing?.serviceId ?? formKey}`}
            label="Nome"
            value={form.contentKey}
            onChange={(key, lbl) =>
              setForm((f) => ({ ...f, contentKey: key, name: lbl ?? f.name }))
            }
            defaultLang={defaultLang}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duração (min)"
              type="number"
              min={5}
              value={form.duration}
              onChange={(e: any) =>
                setForm((f) => ({ ...f, duration: e.target.value }))
              }
            />
            <Input
              label="Preço (€)"
              type="number"
              min={0}
              step={0.5}
              value={form.price}
              onChange={(e: any) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
            />
          </div>
          <CmsComboService
            key={`desc-${editing?.serviceId ?? formKey}`}
            label="Descrição"
            value={form.descriptionKey}
            onChange={(key) => setForm((f) => ({ ...f, descriptionKey: key }))}
            defaultLang={defaultLang}
          />
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Cor do serviço
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-white dark:bg-zinc-900 shrink-0"
              />
              <div className="flex flex-wrap gap-2">
                {SERVICE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-800" : "hover:scale-110"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────
function ConfiguracoesPanel() {
  const qc = useQueryClient();
  const { data: savedHours, isLoading: loadingHours } =
    useGetScheduleWorkingHours();
  const saveHours = usePostScheduleWorkingHours({
    mutation: {
      onSuccess: () => {
        toast.success("Horários guardados");
        setSavedHoursSnapshot(hours);
        qc.invalidateQueries({ queryKey: getScheduleWorkingHoursQueryKey() });
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const [hours, setHours] = useState<WorkingHours[]>(DEFAULT_WORKING_HOURS);
  const [savedHoursSnapshot, setSavedHoursSnapshot] = useState<WorkingHours[]>(
    DEFAULT_WORKING_HOURS,
  );
  const hasUnsavedHours = workingHoursChanged(hours, savedHoursSnapshot);

  useEffect(() => {
    const next =
      savedHours && savedHours.length > 0
        ? DEFAULT_WORKING_HOURS.map(
            (def) =>
              savedHours.find((h) => h.dayOfWeek === def.dayOfWeek) ?? def,
          )
        : DEFAULT_WORKING_HOURS;
    setHours(next);
    setSavedHoursSnapshot(next);
  }, [savedHours]);

  const updateDay = (dayOfWeek: number, patch: Partial<WorkingHours>) =>
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)),
    );

  const { data: blockedSlots = [], isLoading: loadingSlots } =
    useGetScheduleBlockedSlots(undefined);
  const createSlot = usePostScheduleBlockedSlots({
    mutation: {
      onSuccess: () => {
        toast.success("Dia bloqueado");
        qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() });
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const deleteSlot = useDeleteScheduleBlockedSlotsId({
    mutation: {
      onSuccess: () => {
        toast.success("Bloqueio removido");
        qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() });
      },
      onError: (error) => toast.error(getApiError(error)),
    },
  });
  const [newSlot, setNewSlot] = useState({
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  const [vacationForm, setVacationForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const vacation = usePostScheduleBlockedSlotsVacation({
    mutation: {
      onSuccess: (data: any) => {
        toast.success(data.message);
        qc.invalidateQueries({ queryKey: getScheduleBlockedSlotsQueryKey() });
        setVacationForm({ startDate: "", endDate: "", reason: "" });
      },
      onError: (error: any) => toast.error(getApiError(error)),
    },
  });

  const vacDays = useMemo(() => {
    if (!vacationForm.startDate || !vacationForm.endDate) return 0;
    const s = new Date(vacationForm.startDate + "T00:00:00");
    const e = new Date(vacationForm.endDate + "T00:00:00");
    if (e < s) return 0;
    return Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  }, [vacationForm.startDate, vacationForm.endDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* ── Left: Working hours ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white">
            Horário de trabalho
          </h3>
          <Button
            size="sm"
            variant={hasUnsavedHours ? "primary" : "secondary"}
            onClick={() => saveHours.mutate({ data: { hours } })}
            disabled={saveHours.isPending || loadingHours || !hasUnsavedHours}
          >
            {saveHours.isPending
              ? "A guardar…"
              : hasUnsavedHours
                ? "Guardar horários"
                : "Sem alterações"}
          </Button>
        </div>
        {loadingHours ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800 mb-2"
            />
          ))
        ) : (
          <div className="space-y-2">
            {hours.map((h) => {
              const hasLunch = !!(h.lunchStart && h.lunchEnd);
              return (
                <Card key={h.dayOfWeek} className="p-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        updateDay(h.dayOfWeek, { isActive: !h.isActive })
                      }
                      className={`shrink-0 w-9 h-5 rounded-full transition-colors ${h.isActive ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700"}`}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${h.isActive ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                    <span className="w-14 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {FULL_DAY_NAMES[h.dayOfWeek]}
                    </span>
                    {h.isActive ? (
                      <div className="flex flex-wrap flex-1 items-center gap-x-2 gap-y-1.5">
                        <input
                          type="time"
                          value={h.startTime}
                          onChange={(e) =>
                            updateDay(h.dayOfWeek, {
                              startTime: e.target.value,
                            })
                          }
                          className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                        />
                        <span className="text-zinc-400 text-xs">até</span>
                        <input
                          type="time"
                          value={h.endTime}
                          onChange={(e) =>
                            updateDay(h.dayOfWeek, { endTime: e.target.value })
                          }
                          className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                        />
                        <button
                          onClick={() =>
                            hasLunch
                              ? updateDay(h.dayOfWeek, {
                                  lunchStart: null,
                                  lunchEnd: null,
                                })
                              : updateDay(h.dayOfWeek, {
                                  lunchStart: "12:00",
                                  lunchEnd: "13:00",
                                })
                          }
                          title={
                            hasLunch
                              ? "Remover pausa de almoço"
                              : "Adicionar pausa de almoço"
                          }
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition ${hasLunch ? "border-accent/40 text-accent bg-accent/5 dark:bg-accent/10" : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"}`}
                        >
                          <Icon name="clock" className="w-3 h-3" /> Almoço
                        </button>
                        {hasLunch && (
                          <>
                            <input
                              type="time"
                              value={h.lunchStart ?? ""}
                              onChange={(e) =>
                                updateDay(h.dayOfWeek, {
                                  lunchStart: e.target.value,
                                })
                              }
                              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                            />
                            <span className="text-zinc-400 text-xs">–</span>
                            <input
                              type="time"
                              value={h.lunchEnd ?? ""}
                              onChange={(e) =>
                                updateDay(h.dayOfWeek, {
                                  lunchEnd: e.target.value,
                                })
                              }
                              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-zinc-400">
                        Fechado
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Right: Vacation + blocked slots ── */}
      <div className="space-y-8">
        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
            Férias
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            Bloqueia vários dias consecutivos de uma só vez.
          </p>
          <Card className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <p className="text-xs text-zinc-500 mb-1">De *</p>
                <input
                  type="date"
                  value={vacationForm.startDate}
                  onChange={(e) =>
                    setVacationForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Até *</p>
                <input
                  type="date"
                  value={vacationForm.endDate}
                  min={vacationForm.startDate}
                  onChange={(e) =>
                    setVacationForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Motivo (opcional)</p>
                <input
                  value={vacationForm.reason}
                  onChange={(e) =>
                    setVacationForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="Ex: Férias de verão"
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                />
              </div>
              <Button
                icon="ban"
                size="sm"
                disabled={
                  vacation.isPending ||
                  !vacationForm.startDate ||
                  !vacationForm.endDate ||
                  vacDays === 0
                }
                onClick={() =>
                  vacation.mutate({
                    data: {
                      startDate: vacationForm.startDate,
                      endDate: vacationForm.endDate,
                      reason: vacationForm.reason || undefined,
                    } as any,
                  })
                }
              >
                {vacation.isPending
                  ? "A bloquear…"
                  : vacDays > 0
                    ? `Bloquear ${vacDays} dia${vacDays > 1 ? "s" : ""}`
                    : "Bloquear dias"}
              </Button>
            </div>
          </Card>
        </section>

        <section>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
            Bloqueios pontuais
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            Feriados, pausas ou dias específicos. Deixa a hora em branco para
            bloquear o dia inteiro.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSlot.date) return;
              createSlot.mutate({
                data: {
                  date: newSlot.date,
                  startTime: newSlot.startTime || undefined,
                  endTime: newSlot.endTime || undefined,
                  reason: newSlot.reason || undefined,
                },
              });
              setNewSlot({ date: "", startTime: "", endTime: "", reason: "" });
            }}
            className="flex flex-wrap gap-3 mb-4"
          >
            <div>
              <p className="text-xs text-zinc-500 mb-1">Data *</p>
              <input
                type="date"
                required
                value={newSlot.date}
                onChange={(e) =>
                  setNewSlot((s) => ({ ...s, date: e.target.value }))
                }
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Início</p>
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) =>
                  setNewSlot((s) => ({ ...s, startTime: e.target.value }))
                }
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Fim</p>
              <input
                type="time"
                value={newSlot.endTime}
                onChange={(e) =>
                  setNewSlot((s) => ({ ...s, endTime: e.target.value }))
                }
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Motivo</p>
              <input
                value={newSlot.reason}
                onChange={(e) =>
                  setNewSlot((s) => ({ ...s, reason: e.target.value }))
                }
                placeholder="Ex: Feriado"
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                size="sm"
                icon="plus"
                disabled={createSlot.isPending}
              >
                Bloquear
              </Button>
            </div>
          </form>

          {loadingSlots ? (
            <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ) : blockedSlots.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum bloqueio activo.</p>
          ) : (
            <div className="space-y-2">
              {(blockedSlots as any[]).map((slot) => {
                const isFullDay = !slot.startTime && !slot.endTime;
                return (
                  <Card
                    key={slot.blockedSlotId}
                    className="p-3 flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-full min-h-[1.5rem] rounded-full ${isFullDay ? "bg-red-400" : "bg-amber-400"}`}
                      />
                      <div>
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {slot.date}
                        </span>
                        {isFullDay ? (
                          <span className="ml-2 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            Dia inteiro
                          </span>
                        ) : (
                          <span className="ml-2 text-zinc-400">
                            {slot.startTime} — {slot.endTime}
                          </span>
                        )}
                        {slot.reason && (
                          <span className="ml-2 text-zinc-500">
                            · {slot.reason}
                          </span>
                        )}
                      </div>
                    </div>
                    <IconButton
                      icon="trash"
                      label="Remover"
                      onClick={() =>
                        deleteSlot.mutate({ id: slot.blockedSlotId })
                      }
                      className="hover:text-red-500"
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Marcações list panel ─────────────────────────────────────────────────────
function MarcacoesPanel() {
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "pending" | "confirmed" | "completed" | "cancelled"
  >("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");
  const [selAppt, setSelAppt] = useState<Appointment | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(
    null,
  );
  const [isNotifyingList, setIsNotifyingList] = useState(false);
  const notifyAfterSaveListRef = useRef<string | null>(null);
  const notifyAfterReactivateListRef = useRef<string | null>(null);
  const notifyContextListRef = useRef<"save" | "reactivate">("save");

  const { data: allAppts = [], isLoading } =
    useGetScheduleAppointments(undefined);
  const { data: services = [] } = useGetScheduleServices();
  const { data: customersData } = useGetCustomers();
  const customers = customersData?.rows ?? [];

  const updateAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        if (!notifyAfterSaveListRef.current)
          toast.success("Marcação actualizada");
        qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
        const notifyId = notifyAfterSaveListRef.current;
        if (notifyId) {
          notifyAfterSaveListRef.current = null;
          setIsNotifyingList(true);
          notifyApptList.mutate({ id: notifyId });
        }
      },
      onError: (error) => {
        notifyAfterSaveListRef.current = null;
        toast.error(getApiError(error));
      },
    },
  });
  const notifyApptList = usePostScheduleAppointmentsIdNotify({
    mutation: {
      onSuccess: () => {
        const ctx = notifyContextListRef.current;
        notifyContextListRef.current = "save";
        toast.success(
          ctx === "reactivate"
            ? "Marcação reativada e cliente notificado"
            : "Marcação guardada e cliente notificado",
        );
        setIsNotifyingList(false);
      },
      onError: (error) => {
        const ctx = notifyContextListRef.current;
        notifyContextListRef.current = "save";
        toast.success(
          ctx === "reactivate" ? "Marcação reativada" : "Marcação guardada",
        );
        toast.error(getApiError(error) || "Erro ao enviar email ao cliente");
        setIsNotifyingList(false);
      },
    },
  });
  const lastStatusRef = useRef<string | null>(null);
  const setStatusAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
        const reactivateNotifyId = notifyAfterReactivateListRef.current;
        if (reactivateNotifyId) {
          notifyAfterReactivateListRef.current = null;
          notifyContextListRef.current = "reactivate";
          setIsNotifyingList(true);
          notifyApptList.mutate({ id: reactivateNotifyId });
        } else {
          toast.success(
            lastStatusRef.current === "cancelled"
              ? "Marcação cancelada"
              : "Marcação reativada",
          );
          setSelAppt(null);
        }
      },
      onError: (error) => {
        notifyAfterReactivateListRef.current = null;
        toast.error(getApiError(error));
      },
    },
  });
  const cancelAndNotifyApptList = useMutation({
    mutationFn: async (id: string) => {
      await putScheduleAppointmentsId(id, { status: "cancelled" } as any);
      await postScheduleAppointmentsIdNotify(id);
    },
    onSuccess: () => {
      toast.success("Marcação cancelada e cliente notificado");
      qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
      setSelAppt(null);
    },
    onError: (error) => {
      toast.success("Marcação cancelada");
      toast.error(getApiError(error) || "Erro ao enviar email ao cliente");
      qc.invalidateQueries({ queryKey: getScheduleAppointmentsQueryKey() });
      setSelAppt(null);
    },
  });

  const filtered = useMemo(() => {
    let list = allAppts as Appointment[];
    if (filterStatus) list = list.filter((a) => a.status === filterStatus);
    if (filterDateFrom) list = list.filter((a) => a.date >= filterDateFrom);
    if (filterDateTo) list = list.filter((a) => a.date <= filterDateTo);
    if (filterServiceId)
      list = list.filter((a) => a.serviceId === filterServiceId);
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(
        (a) =>
          (a.clientName ?? "").toLowerCase().includes(ql) ||
          (a.clientEmail ?? "").toLowerCase().includes(ql) ||
          (a.clientPhone ?? "").includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const ua = (a as any).updatedAt ?? a.date + "T" + a.time;
      const ub = (b as any).updatedAt ?? b.date + "T" + b.time;
      return ub.localeCompare(ua);
    });
  }, [
    allAppts,
    filterStatus,
    filterDateFrom,
    filterDateTo,
    filterServiceId,
    q,
  ]);

  const hasFilters =
    q || filterStatus || filterDateFrom || filterDateTo || filterServiceId;
  const clearFilters = () => {
    setQ("");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterServiceId("");
  };

  const STATUS_PILLS = [
    { value: "" as const, label: "Todas" },
    { value: "pending" as const, label: "Pendentes" },
    { value: "confirmed" as const, label: "Confirmadas" },
    { value: "completed" as const, label: "Concluídas" },
    { value: "cancelled" as const, label: "Canceladas" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-zinc-500 mb-1">Procurar</p>
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, email ou telefone…"
                className="w-full pl-8 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">De</p>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Até</p>
            <input
              type="date"
              value={filterDateTo}
              min={filterDateFrom}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Serviço</p>
            <select
              value={filterServiceId}
              onChange={(e) => setFilterServiceId(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {services.map((s) => (
                <option key={s.serviceId} value={s.serviceId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${filterStatus === value ? "bg-accent text-white border-accent" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <p className="text-sm text-zinc-400 px-1">
        {isLoading
          ? "A carregar…"
          : `${filtered.length} marcaç${filtered.length === 1 ? "ão" : "ões"}`}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-zinc-400 text-sm">Nenhuma marcação encontrada.</p>
        </Card>
      ) : (
        <div
          className="overflow-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
          style={{ maxHeight: "calc(100vh - 22rem)" }}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-900">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Data / Hora
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">
                  Serviço
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">
                  Pago
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const svc = services.find((s) => s.serviceId === a.serviceId);
                const status = (a.status ??
                  "pending") as keyof typeof STATUS_LABELS;
                const isPaid = !!a.paidAt;
                const color = colorForService(a.serviceId, services);
                return (
                  <tr
                    key={a.appointmentId}
                    onClick={() => setSelAppt(a)}
                    className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <div>
                          <p className="font-medium text-zinc-800 dark:text-zinc-100">
                            {a.date}
                          </p>
                          <p className="text-xs text-zinc-400">{a.time}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                        {a.clientName}
                      </p>
                      <p className="text-xs text-zinc-400">{a.clientPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 hidden sm:table-cell">
                      {svc?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          status === "confirmed" || status === "completed"
                            ? "green"
                            : status === "cancelled"
                              ? "red"
                              : "amber"
                        }
                      >
                        {STATUS_LABELS[status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {isPaid ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <Icon name="euro" className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selAppt && (
        <ApptModal
          appt={
            allAppts.find((a) => a.appointmentId === selAppt.appointmentId) ??
            selAppt
          }
          services={services}
          onClose={() => setSelAppt(null)}
          onSave={(id, data) => updateAppt.mutate({ id, data })}
          onSaveAndNotify={(id, data) => {
            notifyContextListRef.current = "save";
            notifyAfterSaveListRef.current = id;
            updateAppt.mutate({ id, data });
          }}
          onReactivateAndNotify={(id, data) => {
            notifyAfterReactivateListRef.current = id;
            lastStatusRef.current = "confirmed";
            setStatusAppt.mutate({
              id,
              data: { status: "confirmed", ...data },
            });
          }}
          onCancelAndNotify={(id) => cancelAndNotifyApptList.mutate(id)}
          isNotifying={isNotifyingList}
          onSetStatus={(id, status, data) => {
            lastStatusRef.current = status;
            setStatusAppt.mutate({ id, data: { status, ...data } });
          }}
          isSaving={updateAppt.isPending}
          isSettingStatus={
            setStatusAppt.isPending || cancelAndNotifyApptList.isPending
          }
          onOpenCustomer={(() => {
            const currentAppt =
              allAppts.find((a) => a.appointmentId === selAppt.appointmentId) ??
              selAppt;
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
            setSelAppt(appt);
          }}
        />
      )}
    </div>
  );
}

// ─── Agenda root ──────────────────────────────────────────────────────────────
const TABS = [
  ["cal", "Calendário", "calendar"],
  ["marcacoes", "Marcações", "grid"],
  ["servicos", "Serviços", "scissors"],
  ["config", "Configurações", "clock"],
] as const;

export function Agenda() {
  const [searchParams] = useSearchParams();
  const [vista, setVista] = useState<
    "cal" | "marcacoes" | "servicos" | "config"
  >(searchParams.get("openService") ? "servicos" : "cal");
  return (
    <div>
      <PageHeader title="Agenda" subtitle="Marcações, serviços e horários." />
      <div className="flex items-center gap-1 p-1 mb-6 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl w-full sm:w-auto sm:inline-flex overflow-x-auto">
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${vista === id ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            <Icon name={icon} className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      {vista === "cal" && <CalendarioView />}
      {vista === "marcacoes" && <MarcacoesPanel />}
      {vista === "servicos" && <ServicosPanel />}
      {vista === "config" && <ConfiguracoesPanel />}
    </div>
  );
}
