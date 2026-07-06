import type { Notification } from "../hooks/useNotifications";

/**
 * Deep-link de uma notificação → rota do backoffice (path + query string) ou
 * `null` quando não há destino sensato (ex.: "system").
 *
 * Espelha os payloads de `notifyUser` na API: cada `type` traz no `data` as
 * chaves convencionais (appointmentId, customerId, productId, period, …). Os
 * destinos usam os parâmetros que cada página já lê:
 *   - Agenda     `?marcacao=<id>` · `?data=YYYY-MM-DD`
 *   - Clientes   `?cliente=<id>` — raiz `/clientes` (perfil do cliente)
 *   - Leads      `/clientes/leads?lead=<id>` — rota "Leads" (T2.2, submenu de Clientes)
 *     (um novo lead usa `type:"customer"` com `data.leadId`, sem `customerId` —
 *     ver `leadController.ts` na API; distingue-se do cliente normal por isso)
 *   - Financeiro `/financeiro/ginasio`
 *   - Loja       `/loja/encomendas` · `?openProduct=<id>` (produtos = raiz `/loja`)
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
      return "/loja/encomendas";

    case "customer": {
      // Um lead novo notifica com `type:"customer"` mas carrega `data.leadId`
      // (sem `customerId`, ver leadController.ts) — deep-link para a tab Leads
      // em vez da ficha do cliente, que não existe para um mero prospect.
      const lid = str("leadId");
      if (lid) return `/clientes/leads?lead=${encodeURIComponent(lid)}`;
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
      return "/financeiro/ginasio";

    case "stock": {
      const pid = str("productId");
      return pid ? `/loja?openProduct=${encodeURIComponent(pid)}` : "/loja";
    }

    case "reminder": {
      // Lembretes-resumo: marcações (data.date) → agenda na semana certa;
      // mensalidades em atraso (data.period) → Financeiro/Ginásio (Cobranças).
      const date = day("date");
      if (date) return `/agenda?data=${encodeURIComponent(date)}`;
      if (str("period")) return "/financeiro/ginasio";
      return "/agenda";
    }

    case "system":
    default:
      // Inclui o chat (que avisa por toast/badge, não pelo sino) e qualquer
      // tipo sem destino: a notificação é clicável só para marcar como lida.
      return null;
  }
}
