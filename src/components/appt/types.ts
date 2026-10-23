import type { Appointment, AppointmentStatusEnum } from "../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../gen/backoffice/types/Service.js";

export type ApptModalProps = {
  appt: Appointment;
  services: Service[];
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
  onSetStatus: (id: string, status: AppointmentStatusEnum, data?: Record<string, unknown>) => void;
  isSaving: boolean;
  isSettingStatus?: boolean;
  rescheduledFrom?: { date: string; time: string };
  initialDate?: string;
  initialTime?: string;
  onOpenCustomer?: () => void;
  /** Dívida acumulada deste cliente noutras marcações (avisa no topo do pagamento). */
  priorDebt?: number;
  /** Cliente associado (para a preferência de contribuinte na fatura). */
  customer?: { customerId: string; nif?: string | null; wantsInvoice?: boolean } | null;
  /** Persiste a preferência de contribuinte/NIF no cliente. */
  onSaveCustomer?: (customerId: string, data: { wantsInvoice: boolean; nif: string | null }) => void;
  /** "Editar marcação": reverte Concluída → Confirmada SEM fechar a modal. */
  onReopen?: (id: string) => void;
};
