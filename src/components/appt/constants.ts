import type { AppointmentStatusEnum } from "../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../gen/backoffice/types/Service.js";

export const STATUS_LABELS: Record<AppointmentStatusEnum, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const SERVICE_COLORS = [
  "#2A6FDB",
  "#1F8A5B",
  "#D97757",
  "#7C5CDB",
  "#E6B450",
  "#0EA5A4",
  "#DB2A6F",
  "#5C2ADB",
];

export function stableColorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SERVICE_COLORS[h % SERVICE_COLORS.length];
}

export function colorForService(
  serviceId: string | null | undefined,
  services: Service[],
): string {
  const svc = services.find((s) => s.serviceId === serviceId);
  return svc?.color ?? stableColorForId(serviceId ?? "");
}

export const DAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const STATUS_TONE: Record<AppointmentStatusEnum, string> = {
  pending: "amber",
  confirmed: "green",
  completed: "green",
  cancelled: "red",
};
