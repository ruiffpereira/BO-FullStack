import { useState } from "react";
import { Card, Button } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import {
  useScheduleCalendarFeed,
  useRotateScheduleCalendarToken,
} from "../hooks/useScheduleCalendar";

/**
 * Card "Subscrever calendário" da Agenda (Backoffice, PT, sem CMS).
 * Ação principal = botões que abrem/adicionam ao calendário num clique
 * (`webcal://` abre a app de calendário do dispositivo; "Google Calendar" abre
 * no browser). O link em texto + instruções manuais ficam OPCIONAIS (escondidos
 * em "Copiar link"). Regenerar o token invalida a subscrição antiga.
 * Gera o token na 1.ª vez ao abrir os detalhes.
 */
export function CalendarSubscribeCard() {
  const [open, setOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useScheduleCalendarFeed();
  const rotate = useRotateScheduleCalendarToken();

  const httpsUrl = data?.url ?? "";
  const webcalUrl = data?.webcalUrl ?? "";
  // "Adicionar por URL" do Google Calendar (abre no browser).
  const googleUrl = httpsUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`
    : "";

  const copy = async () => {
    if (!httpsUrl) return;
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível — ignora */
    }
  };

  const btnPrimary =
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90";
  const btnOutline =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-50 dark:hover:bg-zinc-800";

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
            Subscreve a tua agenda no telemóvel num clique. As marcações dos
            próximos 90 dias aparecem automaticamente e atualizam-se sozinhas.
          </p>

          {isLoading ? (
            <p className="text-xs text-zinc-400">A carregar…</p>
          ) : (
            <>
              {/* Ação principal: abrir/adicionar ao calendário num clique */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a href={webcalUrl} className={btnPrimary}>
                  <Icon name="calendar" className="w-4 h-4" />
                  Subscrever
                </a>
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnOutline}
                >
                  Google Calendar
                </a>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                <b>Subscrever</b> abre a app de calendário do telemóvel (Apple,
                Outlook…). <b>Google Calendar</b> abre no browser.
              </p>

              {/* Opcional: link manual + instruções de cópia */}
              <button
                onClick={() => setShowManual((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-accent"
              >
                <Icon
                  name="chevronDown"
                  className={`w-3 h-3 transition-transform ${showManual ? "rotate-180" : ""}`}
                />
                Copiar link / adicionar manualmente
              </button>

              {showManual && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2">
                    <span className="flex-1 text-[11px] text-zinc-600 dark:text-zinc-300 truncate font-mono">
                      {httpsUrl}
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
                      <b>Google Calendar:</b> Outros calendários → Por URL → cola o
                      link.
                    </li>
                    <li>
                      <b>Apple Calendar:</b> Ficheiro → Nova subscrição de
                      calendário → cola o link.
                    </li>
                  </ol>
                </div>
              )}

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
