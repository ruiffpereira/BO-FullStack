import { colorForService } from "./constants";
import { activeMethodFor, buildApptSaveData, paymentChangedFrom, paymentPayload, paymentTotals, priceMismatchFor } from "./paymentMath";
import { useState, useRef } from "react";
import { startOfMonth, eachDayOfInterval, startOfWeek, addDays, parseISO } from "date-fns";
import { useWriteGuard } from "../../hooks/useWriteGuard";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { confirmDialog } from "../confirm";
import { paymentTone } from "../../lib/paymentTone";
import type { ApptModalProps } from "./types";

/** Estado, derivados e acções da modal de marcação (os componentes de `components/appt/` só desenham). */
export function useApptEditor(props: ApptModalProps) {
  const { appt, services, onClose, onSave, onSetStatus, isSaving, isSettingStatus, rescheduledFrom, initialDate, initialTime, onOpenCustomer, priorDebt = 0, customer, onSaveCustomer, onReopen } = props;
  const { readOnly: billingReadOnly, message: billingLockMsg } = useWriteGuard();
  // Equipa (B41 2b): o dinheiro da marcação é uma folha própria. Sem `valores` (ver) a API nem envia os campos —
  // a secção Pagamento desaparece (nunca "0 €"); só com `edit` se pode registar/editar pagamentos.
  const { can } = useTeamAccess();
  const showMoney = can("agenda.marcacoes.valores", "view");
  const editMoney = can("agenda.marcacoes.valores", "edit");
  const [editServiceId, setEditServiceId] = useState(appt.serviceId as string);
  // Profissional (opcional; '' = sem). O preço próprio dele só se mostra a quem lê a ficha dele e vê os valores.
  const [editStaffId, setEditStaffId] = useState(appt.staffId ?? "");
  const svc = services.find((s) => s.serviceId === editServiceId);
  const status = appt.status ?? "pending";
  // Modo de edição de uma vaga já paga: "details" (serviço/hora) ou "payment"
  // (valores/gorjeta). Local — só aplica ao Guardar; Cancelar descarta. null = ver.
  const [editMode, setEditMode] = useState<null | "details" | "payment">(null);
  const canEdit =
    status === "pending" || status === "confirmed" || status === "cancelled" || editMode === "details";
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
  // Preferência de contribuinte na fatura (persiste no cliente).
  const [wantsInvoice, setWantsInvoice] = useState(!!customer?.wantsInvoice);
  const [nifInput, setNifInput] = useState(customer?.nif ?? "");

  const isPaid = !!appt.paidAt;
  const pay = { cash, mbway, card, tip };
  const { tipVal, payNoTip, payTotal } = paymentTotals(pay);
  const price = Number(svc?.price ?? 0);

  const snapshotPrice = Number(appt.servicePrice ?? 0);
  const totalPaid = Number(appt.paymentCash ?? 0) + Number(appt.paymentMbway ?? 0) + Number(appt.paymentCard ?? 0);
  // AG-18: a dívida é calculada na API (`debt`, arredondada aos cêntimos); o ecrã só a mostra.
  const debtAmount = Number(appt.debt ?? 0);
  const hasDebt = debtAmount > 0;
  // Ao editar os detalhes de uma vaga paga, se o serviço escolhido tem um preço
  // diferente do que já foi pago → avisa que é preciso acertar (cobrar/devolver).
  const editedServicePrice = Number(svc?.price ?? 0);
  const priceMismatch = priceMismatchFor({
    isPaid,
    editingDetails: editMode === "details",
    serviceChanged: editServiceId !== appt.serviceId,
    editedServicePrice,
    totalPaid,
  });
  const paymentHistory = appt.paymentHistory;

  // Preço de referência do serviço → preenche o pagamento num clique (por método).
  const fillPrice = price || snapshotPrice;
  const fillMethod = (which: "cash" | "mbway" | "card") => {
    setCash(which === "cash" ? String(fillPrice) : "");
    setMbway(which === "mbway" ? String(fillPrice) : "");
    setCard(which === "card" ? String(fillPrice) : "");
  };
  // Preço-alvo (sem gorjeta) que decide o tom do botão único de pagamento e da
  // linha "Total": falta (amber) / certo (blue) / a mais (green) — a MESMA
  // fonte nos dois fluxos (novo + editar). Ver src/lib/paymentTone.ts.
  const targetPrice = price || snapshotPrice;
  const payTone = paymentTone(payNoTip, targetPrice);
  // O botão só desativa por falta de valor no fluxo de NOVO pagamento — ao
  // EDITAR um pagamento já registado, baixar o valor a 0 é uma ação válida
  // (reverter/anular), por isso não se desativa aí.
  const payButtonNoValue = !isPaid && payNoTip <= 0;
  const activeMethod = activeMethodFor(pay, fillPrice);

  const paymentChanged = paymentChangedFrom(appt, pay);
  const detailsChanged =
    editTime !== appt.time ||
    editDate !== appt.date ||
    editServiceId !== appt.serviceId ||
    editStaffId !== (appt.staffId ?? "") ||
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

  const buildSaveData = () =>
    buildApptSaveData({
      appt,
      originalDuration,
      edits: { time: editTime, date: editDate, serviceId: editServiceId, staffId: editStaffId, duration: editDuration },
      pay,
      paymentChanged,
    });

  // Persiste a preferência de contribuinte/NIF no cliente, se mudou.
  const persistCustomerPrefs = () => {
    if (!customer || !onSaveCustomer) return;
    const nifClean = nifInput.trim() || null;
    const changed =
      wantsInvoice !== !!customer.wantsInvoice || (nifClean ?? "") !== (customer.nif ?? "");
    if (changed) onSaveCustomer(customer.customerId, { wantsInvoice, nif: nifClean });
  };

  // Repõe os campos de valor a partir do que está guardado na marcação.
  const resetPaymentInputs = () => {
    setCash(appt.paymentCash != null ? String(appt.paymentCash) : "");
    setMbway(appt.paymentMbway != null ? String(appt.paymentMbway) : "");
    setCard(appt.paymentCard != null ? String(appt.paymentCard) : "");
    setTip("");
  };

  // Entrar/sair dos modos de edição de uma vaga já paga. São LOCAIS: só aplicam
  // ao Guardar; Cancelar descarta tudo (resolve o "cliquei por engano").
  const handleEditAppointment = () => { setTab("details"); setEditMode("details"); };
  const handleEditPayment = () => { resetPaymentInputs(); setTab("payment"); setEditMode("payment"); };
  const handleCancelEdit = () => {
    setEditServiceId(appt.serviceId as string);
    setEditStaffId(appt.staffId ?? "");
    setEditTime(appt.time);
    setEditDate(appt.date);
    setEditDuration(originalDuration);
    resetPaymentInputs();
    setEditMode(null);
  };

  // Guardar: aplica detalhes e/ou pagamento. O backend trata do estado
  // (auto-conclui ao pagar; reverte a Confirmada se a edição deixar dívida).
  const handleSave = () => {
    persistCustomerPrefs();
    const data = buildSaveData();
    if (Object.keys(data).length) onSave(appt.appointmentId, data);
    setEditMode(null);
  };

  // "Guardar pagamento" (fluxo novo): guarda o valor introduzido e conclui.
  // O botão desativa sem valor (payButtonNoValue) — por isso nunca é chamado
  // com payNoTip<=0; para dívida total sem registar nada há "Concluir sem
  // pagamento" (handleCompleteWithoutPayment), abaixo.
  const handlePay = () => {
    persistCustomerPrefs();
    // Envia sempre os valores (mesmo sem mudança) para o backend concluir a vaga.
    const data = buildSaveData();
    Object.assign(data, paymentPayload(pay));
    onSave(appt.appointmentId, data);
  };

  // "Concluir sem pagamento": marca a vaga concluída em dívida total, sem
  // registar nenhum valor. Preserva a capacidade que antes só existia ao
  // clicar "Pagar" com os campos vazios (agora o botão fica desativado nesse
  // caso) — link discreto, só visível quando não há valor introduzido.
  const handleCompleteWithoutPayment = () => {
    persistCustomerPrefs();
    onSetStatus(appt.appointmentId, "completed");
  };

  // AG-06: «Anular pagamento» limpa o pagamento todo (a API volta a pôr a marcação Confirmada e regista o movimento
  // negativo no histórico). Só no modo «Editar pagamento», com confirmação; exige `agenda.marcacoes.valores` (editar).
  const handleCancelPayment = async () => {
    if (!(await confirmDialog({ title: "Anular o pagamento registado?", message: "Os valores recebidos são limpos e a marcação volta a Confirmada. O histórico mantém o rasto.", confirmLabel: "Anular pagamento", danger: true, leaf: "agenda.marcacoes.valores" }))) return;
    persistCustomerPrefs();
    onSave(appt.appointmentId, { cancelPayment: true });
    setEditMode(null);
  };

  const btnRect = datePickerBtnRef.current?.getBoundingClientRect();
  const busy = isSaving || isSettingStatus;

  return { appt, services, onClose, onSave, onSetStatus, isSaving, isSettingStatus, rescheduledFrom, initialDate, initialTime, onOpenCustomer, priorDebt, customer, onSaveCustomer, onReopen, billingReadOnly, billingLockMsg, can, showMoney, editMoney, editServiceId, setEditServiceId, editStaffId, setEditStaffId, svc, status, editMode, setEditMode, canEdit, tab, setTab, confirmCancel, setConfirmCancel, editTime, setEditTime, editDate, setEditDate, showDatePicker, setShowDatePicker, pickerMonth, setPickerMonth, datePickerBtnRef, originalDuration, editDuration, setEditDuration, cash, setCash, mbway, setMbway, card, setCard, tip, setTip, wantsInvoice, setWantsInvoice, nifInput, setNifInput, isPaid, tipVal, payTotal, price, snapshotPrice, totalPaid, debtAmount, hasDebt, editedServicePrice, priceMismatch, paymentHistory, fillPrice, fillMethod, payNoTip, targetPrice, payTone, payButtonNoValue, activeMethod, paymentChanged, detailsChanged, hasChanges, pickerGridStart, pickerGridDays, parsedEditDate, serviceColor, buildSaveData, persistCustomerPrefs, resetPaymentInputs, handleEditAppointment, handleEditPayment, handleCancelEdit, handleSave, handlePay, handleCompleteWithoutPayment, handleCancelPayment, btnRect, busy };
}

export type ApptEditor = ReturnType<typeof useApptEditor>;
