import { Modal, Tabs } from "../ui/ui.jsx";
import { ApptFooter } from "./appt/ApptFooter";
import { ApptClientHeader } from "./appt/ApptClientHeader";
import { ApptDetailsTab } from "./appt/ApptDetailsTab";
import { ApptPaymentTab } from "./appt/ApptPaymentTab";
import { ApptDatePicker } from "./appt/ApptDatePicker";
import { useApptEditor } from "./appt/useApptEditor";
import type { ApptModalProps } from "./appt/types";

// `STATUS_LABELS` e `colorForService` são usados por outras páginas: continuam a sair daqui.
export { STATUS_LABELS, colorForService } from "./appt/constants";

const TABS = [
  { id: "details", label: "Detalhes" },
  { id: "payment", label: "Pagamento" },
];

/** Modal de uma marcação: detalhes (hora, data, serviço, profissional, duração) e pagamento. */
export function ApptModal(props: ApptModalProps) {
  const ctx = useApptEditor(props);
  const { onClose, editMode, showMoney, tab, setTab } = ctx;

  return (
    <>
      <Modal open onClose={onClose} title="Marcação" width="max-w-sm" footer={<ApptFooter ctx={ctx} />}>
        <div className="space-y-4">
          {/* ── Banner amarelo: estás a editar (modo local, só aplica ao Guardar) ── */}
          {editMode && (
            <div role="status" className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/60 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">✏️</span>
              <span>
                {editMode === "details" ? "A editar a marcação" : "A editar o pagamento"} — carrega em <b>Guardar</b> para aplicar ou <b>Cancelar</b> para descartar.
              </span>
            </div>
          )}
          <ApptClientHeader ctx={ctx} />

          {/* ── Abas (sem acesso aos valores só há Detalhes) ── */}
          {showMoney && <Tabs fullWidth size="sm" tabs={TABS} value={tab} onChange={setTab} />}

          {(tab === "details" || !showMoney) && <ApptDetailsTab ctx={ctx} />}
          {showMoney && tab === "payment" && <ApptPaymentTab ctx={ctx} />}
        </div>
      </Modal>
      <ApptDatePicker ctx={ctx} />
    </>
  );
}
