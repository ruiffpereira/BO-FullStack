import { useState } from "react";
import { Card, Button } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import {
  useScheduleCalendarFeed,
  useRotateScheduleCalendarToken,
} from "../hooks/useScheduleCalendar";

/**
 * Card "Subscrever calendário" da Agenda (Backoffice, PT, sem CMS).
 * Mostra o URL do feed .ics da agenda + botão copiar + instruções curtas, e
 * permite regenerar o token (invalida a subscrição antiga). Gera o token na 1.ª
 * vez ao abrir os detalhes.
 */
export function CalendarSubscribeCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useScheduleCalendarFeed();
  const rotate = useRotateScheduleCalendarToken();

  const copy = async () => {
    if (!data?.webcalUrl) return;
    try {
      await navigator.clipboard.writeText(data.webcalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível — ignora */
    }
  };

  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white"
      >
        <Icon name="calendar" className="w-4 h-4 text-accent" />
        Subscrever calendário
        <Icon
          name="chevronDown"
          className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Subscreve a tua agenda no Google ou Apple Calendar. As marcações dos
            próximos 90 dias aparecem automaticamente e atualizam sozinhas.
          </p>

          {isLoading ? (
            <p className="text-xs text-zinc-400">A carregar…</p>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2">
                <span className="flex-1 text-[11px] text-zinc-600 dark:text-zinc-300 truncate font-mono">
                  {data?.webcalUrl ?? ""}
                </span>
                <button
                  onClick={copy}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-accent"
                  aria-label="Copiar link do calendário"
                >
                  <Icon name={copied ? "check" : "copy"} className="w-3.5 h-3.5" />
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>

              <ol className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed list-decimal pl-4 space-y-0.5">
                <li>
                  <b>Google Calendar:</b> Outros calendários → Por URL → cola o link.
                </li>
                <li>
                  <b>Apple Calendar:</b> Ficheiro → Nova subscrição de calendário →
                  cola o link.
                </li>
              </ol>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={rotate.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "Regenerar o link invalida a subscrição atual em todos os dispositivos. Continuar?",
                    )
                  )
                    rotate.mutate();
                }}
              >
                {rotate.isPending ? "A regenerar…" : "Regenerar link"}
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
