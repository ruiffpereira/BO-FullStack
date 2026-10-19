import type { MessagesTeamPeople } from "../gen/backoffice/types/MessagesTeamPeople.js";
import type { MessagesCustomerConversation } from "../gen/backoffice/types/MessagesCustomerConversation.js";

/**
 * Mensagens (B43) — lógica PURA do separador Backoffice e da lista de Clientes.
 * A API já devolve por ordem da última mensagem; aqui garante-se (e testa-se) a regra do desenho:
 * o Suporte vai SEMPRE em primeiro e as pessoas por ordem da última mensagem (sem conversa → no fim, por nome).
 */

/** Chave do Suporte nos URLs/estado (`?com=suporte`); as pessoas usam `owner` ou o `memberId` da API. */
export const SUPPORT_KEY = "suporte";

export interface BackofficeEntry {
  /** `suporte` | `owner` | `<memberId>` */
  key: string;
  kind: "support" | "owner" | "member";
  name: string;
  removed: boolean;
  unread: number;
  lastMessageAt: string | null;
  preview: string | null;
}

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : Number.NEGATIVE_INFINITY);

/** Lista do separador Backoffice: Suporte fixo em primeiro (se o utilizador o pode ver), depois a equipa. */
export function orderBackofficeEntries(
  people: MessagesTeamPeople["people"],
  support: MessagesTeamPeople["support"] | { unread: number; lastMessageAt?: string | null; lastMessage?: { preview?: string } | null } | null,
  opts: { supportVisible?: boolean } = {},
): BackofficeEntry[] {
  const team: BackofficeEntry[] = people
    .map((p) => ({
      key: p.key,
      kind: (p.kind === "owner" ? "owner" : "member") as "owner" | "member",
      name: p.name,
      removed: p.removed,
      unread: p.unread,
      lastMessageAt: p.lastMessageAt ?? null,
      preview: p.lastMessage?.preview ?? null,
    }))
    .sort((a, b) => {
      const d = time(b.lastMessageAt) - time(a.lastMessageAt);
      if (d !== 0 && Number.isFinite(d)) return d;
      // Dois sem conversa (ou iguais): por nome, estável.
      if (a.lastMessageAt === b.lastMessageAt) return a.name.localeCompare(b.name, "pt");
      return a.lastMessageAt ? -1 : 1;
    });

  const supportVisible = opts.supportVisible ?? support !== null;
  if (!supportVisible) return team;
  const head: BackofficeEntry = {
    key: SUPPORT_KEY,
    kind: "support",
    name: "Suporte",
    removed: false,
    unread: support?.unread ?? 0,
    lastMessageAt: support?.lastMessageAt ?? null,
    preview: support?.lastMessage?.preview ?? null,
  };
  return [head, ...team];
}

/** Total por ler do separador Backoffice (equipa + suporte), para o selo do separador. */
export function backofficeUnread(summary: { team: number | null; support: number | null } | undefined): number {
  return (summary?.team ?? 0) + (summary?.support ?? 0);
}

/** Pré-visualização de uma conversa de cliente: "Tu: …" quando a última foi do negócio. */
export function customerPreview(c: MessagesCustomerConversation): string {
  if (!c.lastMessage) return "—";
  return (c.lastMessage.senderRole === "business" ? "Tu: " : "") + (c.lastMessage.preview ?? "");
}
