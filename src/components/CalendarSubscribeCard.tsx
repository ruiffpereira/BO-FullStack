import { useState } from "react";
import type { FocusEvent } from "react";
import { Card, Button, Input } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { confirmDialog } from "./confirm";
import {
  useScheduleCalendarFeed,
  useRotateScheduleCalendarToken,
} from "../hooks/useScheduleCalendar";

/**
 * Card "Subscrever calendário" da Agenda (Backoffice, PT, sem CMS).
 *
 * Ação principal = COPIAR o link `https://…ics` (funciona sempre, em qualquer
 * dispositivo/browser) + instrução curta para colar no Google/Apple/Outlook
 * "por URL". `webcal://` fica como ação secundária ("Abrir na app") — em muitos
 * PCs sem app de calendário associada ao esquema `webcal:`, clicar não faz
 * nada, por isso não pode ser a única forma de subscrever. O antigo botão
 * "Google Calendar" (`calendar/r?cid=`) foi removido: esse deep-link é
 * pouco fiável (falha com frequência mesmo com feeds válidos) — a via "Através
 * do URL" é a que o Google recomenda e funciona sempre.
 *
 * Trata explicitamente o estado de erro do GET `/schedule/calendar`: sem isso,
 * uma falha deixava `url`/`webcalUrl` a `""` e os botões viravam links mortos
 * sem qualquer aviso.
 */
export function CalendarSubscribeCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, isLoading, isError, refetch } = useScheduleCalendarFeed();
  const rotate = useRotateScheduleCalendarToken();

  const httpsUrl = data?.url ?? "";
  const webcalUrl = data?.webcalUrl ?? "";
  const failed = isError || (!isLoading && !data);

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
            Subscreve a tua agenda no telemóvel ou no computador. As marcações
            dos próximos 90 dias aparecem automaticamente e atualizam-se
            sozinhas.
          </p>

          {isLoading ? (
            <p className="text-xs text-zinc-400">A carregar…</p>
          ) : failed ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
              <Icon
                name="alertTriangle"
                className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-xs text-red-700 dark:text-red-300">
                  Não foi possível carregar o link do calendário.
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300 underline underline-offset-2"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Ação principal: copiar o link https:// (funciona sempre) */}
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    label="Link do calendário"
                    value={httpsUrl}
                    readOnly
                    onFocus={(e: FocusEvent<HTMLInputElement>) =>
                      e.target.select()
                    }
                    className="font-mono text-xs truncate cursor-text"
                  />
                </div>
                <Button
                  type="button"
                  variant={copied ? "secondary" : "primary"}
                  onClick={copy}
                  aria-label="Copiar link do calendário"
                  icon={copied ? "check" : "copy"}
                  className="shrink-0"
                >
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                <b>Google Calendar:</b> Outros calendários → <b>+</b> →{" "}
                <b>Através do URL</b> → cola este link.{" "}
                <b>Apple Calendar/Outlook:</b> adiciona uma subscrição de
                calendário por URL e cola o mesmo link.
              </p>

              {/* Ação secundária: abrir na app de calendário do dispositivo */}
              <a href={webcalUrl} className={`${btnOutline} w-full`}>
                <Icon name="calendar" className="w-4 h-4" />
                Abrir na app de calendário
              </a>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                Funciona no telemóvel ou num computador com uma app de
                calendário associada (Apple Calendar, Outlook…). Se não
                acontecer nada ao clicar, usa o link acima.
              </p>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={rotate.isPending}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: "Regenerar o link de subscrição?",
                      message:
                        "A subscrição atual deixa de funcionar em todos os dispositivos.",
                      confirmLabel: "Regenerar",
                      danger: true,
                    })
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
