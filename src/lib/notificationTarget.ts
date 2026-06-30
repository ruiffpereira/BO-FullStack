import type { Notification } from "../hooks/useNotifications";

/**
 * Deep-link de uma notificação → rota do backoffice (path + query string) ou
 * `null` quando não há destino sensato (ex.: "system").
 *
 * Espelha os payloads de `notifyUser` na API: cada `type` traz no `data` as
 * chaves convencionais (appointmentId, customerId, productId, period, …). Os
 * destinos usam os parâmetros que cada página já lê:
 *   - Agenda     `?marcacao=<id>` · `?data=YYYY-MM-DD`
 *   - Clientes   `?cliente=<id>`
 *   - Financeiro `?vista=ginasio`
 *   - Loja       `?tab=encomendas` · `?openProduct=<id>`
 *   - Mensagens  (sem parâmetro)
 */
export function notificationHref(
  n: Pick<Notification, "type" | "data">,
): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null => {
    const v = data[key];
    return typeof v === "string" && v ? v : null;
  };
  const day = (key: string): string | null => {
    const v = str(key);
    return v ? v.slice(0, 10) : null; // tolera ISO datetime → YYYY-MM-DD
  };

  switch (n.type) {
    case "booking": {
      const appt = str("appointmentId");
      if (appt) return `/agenda?marcacao=${encodeURIComponent(appt)}`;
      const date = day("date");
      return date ? `/agenda?data=${encodeURIComponent(date)}` : "/agenda";
    }

    case "order":
      return "/loja?tab=encomendas";

    case "customer": {
      const cid = str("customerId");
      return cid ? `/clientes?cliente=${encodeURIComponent(cid)}` : "/clientes";
    }

    case "gym": {
      // Notificações de ginásio normalmente referem um cliente (ex.: plano a
      // terminar) → ficha do cliente (tab Ginásio); senão, a página do ginásio.
      const cid = str("customerId");
      return cid ? `/clientes?cliente=${encodeURIComponent(cid)}` : "/ginasio";
    }

    case "payment":
      return "/financeiro?vista=ginasio";

    case "stock": {
      const pid = str("productId");
      return pid ? `/loja?openProduct=${encodeURIComponent(pid)}` : "/loja";
    }

    case "reminder": {
      // Lembretes-resumo: marcações (data.date) → agenda na semana certa;
      // mensalidades em atraso (data.period) → Financeiro/Ginásio (Cobranças).
      const date = day("date");
      if (date) return `/agenda?data=${encodeURIComponent(date)}`;
      if (str("period")) return "/financeiro?vista=ginasio";
      return "/agenda";
    }

    case "system":
    default:
      // Inclui o chat (que avisa por toast/badge, não pelo sino) e qualquer
      // tipo sem destino: a notificação é clicável só para marcar como lida.
      return null;
  }
}
