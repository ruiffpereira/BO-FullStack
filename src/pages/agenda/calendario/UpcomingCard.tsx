import { Icon } from "../../../ui/icons.jsx";
import { Badge, Card } from "../../../ui/ui.jsx";
import { colorForService } from "../../../components/ApptModal.js";
import type { Appointment } from "../../../gen/backoffice/types/Appointment.js";
import type { Service } from "../../../gen/backoffice/types/Service.js";

/** Cartão lateral «Próximas vagas»: as próximas marcações não canceladas. */
export function UpcomingCard({
  upcoming,
  services,
  today,
  onSelect,
}: {
  upcoming: Appointment[];
  services: Service[];
  today: string;
  onSelect: (a: Appointment) => void;
}) {
  return (
        <Card className="p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2 mb-3">
            <Icon name="calendar" className="w-4 h-4 text-accent" />
            Próximas vagas
            {upcoming.length > 0 && (
              <Badge tone="blue">{upcoming.length}</Badge>
            )}
          </h3>
          <div className="space-y-1">
            {upcoming.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem vagas futuras.</p>
            ) : (
              upcoming.map((a) => {
                const color = colorForService(a.serviceId, services);
                const isToday = a.date === today;
                return (
                  <button
                    key={a.appointmentId}
                    onClick={() => onSelect(a)}
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
                        {a.serviceName ? ` · ${a.serviceName}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
  );
}
