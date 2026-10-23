import { fmtEur } from "../../lib/money";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button, Avatar, Modal, Input } from "../../ui/ui.jsx";
import { GuardButton } from "../../components/GuardButton";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { DatePicker } from "../../components/DatePicker";
import { TimeField } from "../../components/TimeField";
import { colorFromName } from "../../lib/avatarColor";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { postCustomers } from "../../gen/backoffice/hooks/usePostCustomers.js";
import type { Service } from "../../gen/backoffice/types/Service.js";
import type { Customer } from "../../gen/backoffice/types/Customer.js";
import { Combobox } from "../../components/Combobox";
import { StaffField } from "../../components/StaffSelect";
import { useAgendaCustomers } from "./useAgendaCustomers";

export function NovaApptModal({
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
    staffId: "",
    notes: "",
  });
  const [q, setQ] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropListRef = useRef<HTMLDivElement>(null);
  const serviceSelectRef = useRef<HTMLButtonElement>(null);
  const [selCustomer, setSelCustomer] = useState<Customer | null>(null);
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", email: "", contact: "" });

  useEffect(() => {
    setEditDate(format(date, "yyyy-MM-dd"));
  }, [date]);
  useEffect(() => {
    if (initialTime) setForm((f) => ({ ...f, time: initialTime }));
  }, [initialTime]);

  // Equipa (B41): um membro sem o módulo Clientes não lê `/customers` (403) — nem se pede.
  const { can: canTeamNova } = useTeamAccess();
  // Sem `agenda.marcacoes.valores` o preço do serviço não aparece nas opções (o dinheiro é dessa folha).
  const novaShowMoney = canTeamNova("agenda.marcacoes.valores", "view");
  const { data: custData, isError: custError } = useAgendaCustomers();
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
      postCustomers(data),
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
      staffId: form.staffId || undefined,
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
          <GuardButton type="submit" form="nova-appt-form" disabled={isPending}>
            {isPending ? "A guardar…" : "Criar marcação"}
          </GuardButton>
        </>
      }
    >
      <form id="nova-appt-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data *</span>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="w-28">
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Hora *</span>
            <TimeField value={form.time} onChange={(v) => setForm((f) => ({ ...f, time: v }))} />
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
              <GuardButton wrapperClassName="block w-full"
                size="sm"
                className="w-full"
                disabled={createCustMut.isPending}
                onClick={handleCreateCust}
              >
                {createCustMut.isPending ? "A criar…" : "Criar e selecionar"}
              </GuardButton>
            </div>
          )}
        </div>

        <hr className="border-zinc-100 dark:border-zinc-800" />

        <Combobox
          ref={serviceSelectRef}
          label="Serviço *"
          value={form.serviceId}
          onChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}
          options={[
            { value: "", label: "Escolher serviço" },
            ...services
              .filter((s) => s.active !== false)
              .map((s) => ({
                value: s.serviceId,
                label: novaShowMoney
                  ? `${s.name} (${s.duration}min — ${fmtEur(Number(s.price))})`
                  : `${s.name} (${s.duration}min)`,
              })),
          ]}
          placeholder="Escolher serviço"
          searchPlaceholder="Pesquisar serviço…"
        />
        <StaffField
          value={form.staffId}
          onChange={(v) => setForm((f) => ({ ...f, staffId: v }))}
          serviceId={form.serviceId}
          leaves={["agenda.marcacoes"]}
        />
        <Input
          label="Notas (opcional)"
          value={form.notes}
          onChange={set("notes")}
        />
      </form>
    </Modal>
  );
}
