import type { GetUsersMeSupportAccessLogs200 } from "../gen/backoffice/types/GetUsersMeSupportAccessLogs.js";

/**
 * Texto do "Registo do suporte" (Perfil → Acesso do suporte). Puro, para se
 * testar sem renderizar. A API devolve `kind` + método + `resourceType` (o 1.º
 * segmento do path) — a tradução para português vive aqui.
 */

export type SupportLogItem = NonNullable<GetUsersMeSupportAccessLogs200["items"]>[number];

/** Segmento do path da API → área legível, com artigo. */
const AREA_BY_RESOURCE: Record<string, string> = {
  services: "os serviços",
  service: "os serviços",
  appointments: "as marcações",
  "working-hours": "os horários",
  "blocked-slots": "os bloqueios da agenda",
  schedule: "a agenda",
  cms: "os conteúdos",
  products: "os produtos",
  product: "os produtos",
  categories: "as categorias",
  category: "as categorias",
  gym: "o ginásio",
  uploads: "ficheiros carregados",
  settings: "as definições",
  languages: "as línguas",
  users: "o perfil",
  customers: "os clientes",
  clientes: "os clientes",
  orders: "as encomendas",
  expenses: "as despesas",
  financeiro: "o financeiro",
  dashboard: "o resumo",
  team: "a equipa",
  notifications: "as notificações",
  chat: "as mensagens",
};

const VERB_BY_METHOD: Record<string, string> = {
  POST: "Criou",
  PUT: "Alterou",
  PATCH: "Alterou",
  DELETE: "Apagou",
};

export function verbForMethod(method: string | undefined): string {
  return VERB_BY_METHOD[(method ?? "").toUpperCase()] ?? "Alterou";
}

/** Área legível; sem correspondência devolve o `resourceType` cru (ou "—"). */
export function areaForResource(resourceType: string | null | undefined): string {
  if (!resourceType) return "—";
  return AREA_BY_RESOURCE[resourceType.toLowerCase()] ?? resourceType;
}

/**
 * O `resourceType` é só o 1.º segmento (`/schedule/services` → "schedule"), por isso
 * procura-se primeiro o segmento mais específico do path que tenha nome conhecido.
 */
export function areaForItem(item: Pick<SupportLogItem, "path" | "resourceType">): string {
  const segments = (item.path ?? "").split("?")[0].split("/").filter(Boolean).reverse();
  const known = segments.find((s) => AREA_BY_RESOURCE[s.toLowerCase()]);
  return known ? AREA_BY_RESOURCE[known.toLowerCase()] : areaForResource(item.resourceType);
}

function daysFromChanges(changes: unknown): number | null {
  const d = (changes as { days?: unknown } | null | undefined)?.days;
  const n = typeof d === "number" ? d : typeof d === "string" ? Number(d) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Quem fez: para dar/revogar acesso é sempre o próprio tenant ("Tu"). */
export function describeSupportActor(item: SupportLogItem): string {
  if (item.kind === "grant" || item.kind === "revoke") return "Tu";
  return item.actorName || "Suporte";
}

/** O que foi feito, em PT-PT. */
export function describeSupportAction(item: SupportLogItem): string {
  switch (item.kind) {
    case "session":
      return "Entrou na tua conta (sessão de suporte)";
    case "grant": {
      const n = daysFromChanges(item.changes);
      return n === null
        ? "Deste acesso ao suporte"
        : `Deste acesso ao suporte por ${n} ${n === 1 ? "dia" : "dias"}`;
    }
    case "revoke":
      return "Revogaste o acesso do suporte";
    // Leituras em sessão de suporte (o que o suporte VIU); área desconhecida → genérico.
    case "view": {
      const area = areaForItem(item);
      return area === "—" || area === item.resourceType ? "Viu a conta" : `Viu ${area}`;
    }
    default:
      return `${verbForMethod(item.method)} ${areaForItem(item)}`;
  }
}

/** `null` quando correu bem; senão o texto do selo. 403 = bloqueado pela API. */
export function failureLabel(item: Pick<SupportLogItem, "success" | "statusCode">): "Bloqueado" | "Falhou" | null {
  if (item.success !== false) return null;
  return item.statusCode === 403 ? "Bloqueado" : "Falhou";
}

const MAX_VALUE_CHARS = 80;

function stringifyValue(v: unknown): string {
  let s: string;
  if (v === null || v === undefined) s = "—";
  else if (typeof v === "string") s = v;
  else {
    try {
      s = JSON.stringify(v) ?? String(v);
    } catch {
      s = String(v);
    }
  }
  return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS)}…` : s;
}

/** Entradas `chave: valor` (truncadas) do campo `changes`; vazio se não houver. */
export function changeEntries(changes: unknown, max = 12): Array<[string, string]> {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, unknown>)
    .slice(0, max)
    .map(([k, v]) => [k, stringifyValue(v)] as [string, string]);
}

/** DD/MM/AAAA (pt-PT); "—" se a data for inválida. */
export function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** HH:mm (pt-PT); "—" se a data for inválida. */
export function formatTimePt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
