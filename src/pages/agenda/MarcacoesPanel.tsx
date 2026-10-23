import { fmtEur } from "../../lib/money";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { apptDebt, apptStatusView } from "../../lib/apptStatus";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Badge } from "../../ui/ui.jsx";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { DatePicker } from "../../components/DatePicker";
import { usePutScheduleAppointmentsId } from "../../gen/backoffice/hooks/usePutScheduleAppointmentsId.js";
import { useGetScheduleServices } from "../../gen/backoffice/hooks/useGetScheduleServices.js";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { useGetScheduleAppointmentsPage } from "../../gen/backoffice/hooks/useGetScheduleAppointmentsPage.js";
import { Pagination, serverPagination } from "../../components/Pagination";
import { invalidateMoney } from "../../lib/invalidateMoney";
import { patchCustomersId } from "../../gen/backoffice/hooks/usePatchCustomersId.js";
import type { Appointment } from "../../gen/backoffice/types/Appointment.js";
import { ApptModal, colorForService } from "../../components/ApptModal.js";
import { Combobox } from "../../components/Combobox";
import { StaffFilterSelect } from "../../components/StaffSelect";
import { useStaffOptions } from "../../hooks/useStaff";
import { STAFF_ALL, staffParam } from "../../lib/staffFilter";
import { toastStaffWarnings } from "../../lib/staffWarnings";
import { useAgendaCustomers } from "./useAgendaCustomers";
import { customerIdForAppointment } from "./geometry";
import { CustomerProfileModal } from "../../components/customers/CustomerProfileModal";

// ─── Marcações list panel ─────────────────────────────────────────────────────
const APPT_PAGE_SIZE = 25;
export function MarcacoesPanel() {
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
  // Profissionais: filtro `?staff=` (Global · Sem profissional · cada um) e coluna «Profissional».
  const [staffSel, setStaffSel] = useState<string>(STAFF_ALL);
  const { hasStaff } = useStaffOptions();
  // Paginação NO SERVIDOR (AG-19): a página pede só o que mostra; filtros e pesquisa vão para a API.
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  // A página vale para um conjunto de filtros: ao mudar um filtro/pesquisa volta à 1 NO MESMO render
  // (nunca sai um pedido com o filtro novo e a página antiga).
  const filtersKey = [qDebounced, filterStatus, filterDateFrom, filterDateTo, filterServiceId, staffSel].join("\u0001");
  const [pageState, setPageState] = useState({ key: filtersKey, page: 1 });
  const apptPage = pageState.key === filtersKey ? pageState.page : 1;
  const setApptPage = (p: number) => setPageState({ key: filtersKey, page: p });
  const { data: pageData, isLoading } = useGetScheduleAppointmentsPage(
    {
      page: apptPage,
      limit: APPT_PAGE_SIZE,
      ...(qDebounced ? { q: qDebounced } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterDateFrom ? { from: filterDateFrom } : {}),
      ...(filterDateTo ? { to: filterDateTo } : {}),
      ...(filterServiceId ? { serviceId: filterServiceId } : {}),
      ...(staffParam(staffSel) ? { staff: staffParam(staffSel) } : {}),
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const allAppts = useMemo(() => pageData?.rows ?? [], [pageData]);
  const apptTotal = pageData?.count ?? 0;
  const { data: services = [] } = useGetScheduleServices();
  const { can: canTeam } = useTeamAccess();
  // Sem `agenda.marcacoes.valores` a API não envia pagamentos: a coluna "Pago" desaparece (nunca "—" nem "0 €").
  const showMoney = canTeam("agenda.marcacoes.valores", "view");
  const { data: customersData } = useAgendaCustomers();
  const customers = customersData?.rows ?? [];

  // Guardar = notificar: o backend avisa o cliente automaticamente ao guardar.
  const updateAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: (data) => {
        toast.success("Marcação actualizada");
        toastStaffWarnings(data?.warnings);
        invalidateMoney(qc);
      },
      onError: (error) => {
        toast.error(getApiError(error));
      },
    },
  });
  const lastStatusRef = useRef<string | null>(null);
  const setStatusAppt = usePutScheduleAppointmentsId({
    mutation: {
      onSuccess: () => {
        invalidateMoney(qc);
        toast.success(
          lastStatusRef.current === "cancelled"
            ? "Marcação cancelada"
            : "Marcação reativada",
        );
        setSelAppt(null);
      },
      onError: (error) => {
        toast.error(getApiError(error));
      },
    },
  });

  const filtered = allAppts as Appointment[];
  const apptPager = serverPagination(apptPage, setApptPage, apptTotal, APPT_PAGE_SIZE, filtered.length);

  const hasFilters =
    q || filterStatus || filterDateFrom || filterDateTo || filterServiceId || staffSel !== STAFF_ALL;
  const clearFilters = () => {
    setQ("");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterServiceId("");
    setStaffSel(STAFF_ALL);
  };

  const STATUS_PILLS = [
    { value: "" as const, label: "Todas" },
    { value: "pending" as const, label: "Pendentes" },
    { value: "confirmed" as const, label: "Confirmadas" },
    { value: "completed" as const, label: "Concluídas" },
    { value: "cancelled" as const, label: "Canceladas" },
  ];

  return (
    <div className="space-y-4 xl:space-y-0 xl:flex xl:flex-col xl:gap-4 xl:h-full xl:min-h-0">
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
            <div className="w-40"><DatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Qualquer" clearable /></div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Até</p>
            <div className="w-40"><DatePicker value={filterDateTo} min={filterDateFrom} onChange={setFilterDateTo} placeholder="Qualquer" clearable /></div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Serviço</p>
            <Combobox
              className="w-44"
              value={filterServiceId}
              onChange={setFilterServiceId}
              options={[
                { value: "", label: "Todos" },
                ...services.map((s) => ({ value: s.serviceId, label: s.name })),
              ]}
              placeholder="Todos"
              searchPlaceholder="Pesquisar serviço…"
            />
          </div>
          {hasStaff && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Profissional</p>
              <StaffFilterSelect value={staffSel} onChange={setStaffSel} leaves={["agenda.marcacoes"]} />
            </div>
          )}
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
          : `${apptTotal} marcaç${apptTotal === 1 ? "ão" : "ões"}`}
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
          className="overflow-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm xl:flex-1 xl:min-h-0"
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
                {hasStaff && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">
                    Profissional
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Estado
                </th>
                {showMoney && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">
                    Pago
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const svc = services.find((s) => s.serviceId === a.serviceId);
                const isPaid = !!a.paidAt;
                const debt = apptDebt(a);
                const apptHasDebt = debt > 0;
                const view = apptStatusView(a);
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
                    {hasStaff && (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 hidden md:table-cell">
                        {a.staff?.name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge tone={view.tone}>{view.statusLabel}</Badge>
                    </td>
                    {showMoney && <td className="px-4 py-3 hidden md:table-cell">
                      {apptHasDebt ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          <Icon name="euro" className="w-3 h-3" /> Dívida {fmtEur(debt)}
                        </span>
                      ) : isPaid ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <Icon name="euro" className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && <Pagination {...apptPager} />}

      {selAppt && (
        <ApptModal
          appt={
            allAppts.find((a) => a.appointmentId === selAppt.appointmentId) ??
            selAppt
          }
          services={services}
          onClose={() => setSelAppt(null)}
          onSave={(id, data) => updateAppt.mutate({ id, data })}
          onSetStatus={(id, status, data) => {
            lastStatusRef.current = status;
            setStatusAppt.mutate({ id, data: { status, ...data } });
          }}
          isSaving={updateAppt.isPending}
          isSettingStatus={setStatusAppt.isPending}
          priorDebt={(allAppts.find((a) => a.appointmentId === selAppt.appointmentId) ?? selAppt).priorDebt ?? 0}
          customer={(() => {
            const ca = allAppts.find((a) => a.appointmentId === selAppt.appointmentId) ?? selAppt;
            const cid = customerIdForAppointment(ca, customers);
            const c = cid ? customers.find((x) => x.customerId === cid) : null;
            return c ? { customerId: c.customerId, nif: c.nif ?? null, wantsInvoice: c.wantsInvoice ?? false } : null;
          })()}
          onSaveCustomer={(id, data) => {
            patchCustomersId(id, data).then(() => qc.invalidateQueries({ queryKey: getCustomersQueryKey() }));
          }}
          onReopen={(id) => updateAppt.mutate({ id, data: { status: "confirmed" } as any })}
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
