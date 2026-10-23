import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Icon } from "../../ui/icons.jsx";
import { Button, Badge, Avatar, Modal, Tabs } from "../../ui/ui.jsx";
import { GuardButton } from "../GuardButton";
import { useAuth } from "../../context/AuthContext";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { colorFromName } from "../../lib/avatarColor";
import { getCustomersQueryKey } from "../../gen/backoffice/hooks/useGetCustomers.js";
import { useGetCustomersIdHistory, getCustomersIdHistoryQueryKey } from "../../gen/backoffice/hooks/useGetCustomersIdHistory.js";
import type { GetCustomersIdHistory200 } from "../../gen/backoffice/types/GetCustomersIdHistory.js";
import { patchCustomersId } from "../../gen/backoffice/hooks/usePatchCustomersId.js";
import type { Appointment } from "../../gen/backoffice/types/Appointment.js";
import type { Customer } from "../../gen/backoffice/types/Customer.js";
import { CustomerEmailsTab } from "../correio/CustomerEmailsTab";
import { CustomerNewsletterBox } from "../correio/CustomerNewsletterBox";
import { OpenConversationShortcut } from "../chat/OpenConversationShortcut";
import { ClienteMensalidade } from "../../pages/gymMensalidade/ClienteMensalidade";
import { customerAccess, profileTabsFor, type ProfileTabId } from "./customerAccess";
import { InvoicePrefsEditor } from "./InvoicePrefsEditor";
import { CustomerAppointmentsSection } from "./CustomerAppointmentsSection";
import { CustomerPrivacy } from "./CustomerPrivacy";

/**
 * Ficha de cliente — UMA só, usada na Agenda (calendário e marcações) e na página Clientes. As permissões vêm todas
 * de `customerAccess` (EQ-06): sem `valores` não há dinheiro, só quem edita `clientes.lista` bloqueia, quem só tem a
 * Agenda mexe apenas na preferência de fatura; as escritas estão atrás de `GuardButton`.
 *
 * `full` (página Clientes) junta o que só aí faz sentido: separadores Agenda/Ginásio/Emails, consentimento de
 * novidades, atalho para a conversa e Privacidade (RGPD). Na Agenda a ficha é a versão curta (só marcações).
 */
export function CustomerProfileModal({
  customerId,
  customers,
  onClose,
  onOpenAppointment,
  full = false,
  onEdit,
  footerLeading,
}: {
  customerId: string;
  /** Lista já carregada pela página (a ficha usa-a enquanto o histórico não chega). */
  customers: Customer[];
  onClose: () => void;
  onOpenAppointment: (appt: Appointment) => void;
  full?: boolean;
  /** Mostra «Editar» no rodapé (a edição vive na página que a passa). */
  onEdit?: (customer: Customer) => void;
  /** Acção extra à esquerda do rodapé (ex.: «Voltar à marcação»). */
  footerLeading?: ReactNode;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const { can } = useTeamAccess();
  const access = customerAccess({ can, hasPermission });
  const { canBlock, onlyInvoicePrefs, showMoney, canSchedule, canGym, canMail, canExport, canErase } = access;

  // Na ficha completa o histórico só se pede a quem vê a Agenda (a API recusa o resto); na curta a Agenda é o contexto.
  const historyEnabled = full ? canSchedule : true;
  const { data: history, isLoading, isError } = useGetCustomersIdHistory<GetCustomersIdHistory200>(customerId, {
    query: { enabled: historyEnabled },
  });
  const customer = history?.customer ?? customers.find((c) => c.customerId === customerId) ?? null;
  // Id que não é deste tenant (deep-link `?cliente=<id alheio>`): a API recusa (404/403) e a ficha fecha — nunca fica um esqueleto aberto.
  useEffect(() => {
    if (isError && !customer) onClose();
  }, [isError, customer]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = profileTabsFor(access);
  const [tab, setTab] = useState<ProfileTabId>(tabs[0]?.id ?? "agenda");
  useEffect(() => {
    setTab(tabs[0]?.id ?? "agenda");
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const showAgenda = full ? tab === "agenda" && canSchedule : true;

  const blockMut = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => patchCustomersId(id, { blocked }),
    onSuccess: (_d, { blocked }) => {
      toast.success(blocked ? "Cliente bloqueado" : "Cliente desbloqueado");
      qc.invalidateQueries({ queryKey: getCustomersQueryKey() });
      qc.invalidateQueries({ queryKey: getCustomersIdHistoryQueryKey(customerId) });
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
          {footerLeading}
          {customer && onEdit && (
            <Button variant="outline" icon="edit" onClick={() => onEdit(customer)}>Editar</Button>
          )}
          {/* Na página Clientes o botão está sempre (a folha da rota é `clientes.lista`: sem `edit` fica desactivado com o motivo);
              na Agenda só aparece a quem edita `clientes.lista`. */}
          {customer && (full || canBlock) && (
            <GuardButton
              leaf="clientes.lista"
              variant="outline"
              disabled={blockMut.isPending}
              onClick={() => blockMut.mutate({ id: customer.customerId, blocked: !customer.blocked })}
              className={
                customer.blocked
                  ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  : "text-red-500 border-red-200 hover:bg-red-50"
              }
            >
              {blockMut.isPending ? "…" : customer.blocked ? "Desbloquear" : "Bloquear"}
            </GuardButton>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
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
            <Avatar name={customer.name} color={colorFromName(customer.name)} size={56} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">{customer.name}</h3>
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
                  {new Date(customer.birthday + "T00:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}
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

          {onlyInvoicePrefs && (
            <InvoicePrefsEditor
              customerId={customer.customerId}
              nif={customer.nif ?? null}
              wantsInvoice={!!customer.wantsInvoice}
            />
          )}

          {/* Consentimento de email de novidades (B42 · fase 8) e atalho para a conversa do cliente (Mensagens → Clientes) */}
          {full && <CustomerNewsletterBox customerId={customer.customerId} />}
          {full && <OpenConversationShortcut customerId={customer.customerId} onNavigate={onClose} />}

          {customer.notes && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Notas</p>
              {customer.notes}
            </div>
          )}

          {/* Separadores por permissão (Agenda / Ginásio / Emails) — só na ficha completa */}
          {full && tabs.length > 0 && (
            <Tabs tabs={tabs} value={tab} onChange={(id: string) => setTab(id as ProfileTabId)} fullWidth size="sm" />
          )}
          {full && tab === "emails" && canMail && <CustomerEmailsTab customerId={customer.customerId} onOpen={onClose} />}
          {full && tab === "ginasio" && canGym && <ClienteMensalidade customerId={customer.customerId} dense />}

          {showAgenda && (
            <CustomerAppointmentsSection
              history={history}
              isLoading={isLoading && historyEnabled}
              showMoney={showMoney}
              onOpenAppointment={onOpenAppointment}
            />
          )}

          {full && (canExport || canErase) && (
            <CustomerPrivacy customer={customer} canExport={canExport} canErase={canErase} onErased={onClose} />
          )}
        </div>
      )}
    </Modal>
  );
}
