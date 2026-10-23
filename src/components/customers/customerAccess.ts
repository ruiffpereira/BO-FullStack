// Permissões da ficha de cliente (EQ-06) — puras, para a ficha única (Agenda e Clientes) e para os testes.

export type CustomerAccessInput = {
  /** `can(folha, nível)` do `useTeamAccess` (o dono pode sempre). */
  can: (key: string, level?: "view" | "edit") => boolean;
  /** `hasPermission(...)` do AuthContext (módulos do tenant). */
  hasPermission: (name: string) => boolean;
};

export type CustomerAccess = {
  /** Bloquear/desbloquear o cliente é da folha `clientes.lista` (edit). */
  canBlock: boolean;
  /** Só tem a Agenda (edit): mexe apenas na preferência de fatura (NIF + «quer fatura»); a API recusa o resto com 403. */
  onlyInvoicePrefs: boolean;
  /** Sem `agenda.marcacoes.valores` (ver) a API nem envia dinheiro: nada de «gasto total», dívida ou valores pagos. */
  showMoney: boolean;
  canSchedule: boolean;
  canGym: boolean;
  canMail: boolean;
  canExport: boolean;
  canErase: boolean;
};

export function customerAccess({ can, hasPermission }: CustomerAccessInput): CustomerAccess {
  const canBlock = can("clientes.lista", "edit");
  return {
    canBlock,
    onlyInvoicePrefs: !canBlock && can("agenda.marcacoes", "edit"),
    showMoney: can("agenda.marcacoes.valores", "view"),
    // Um membro só vê os separadores Agenda/Ginásio da ficha se tiver as folhas desses módulos (a API recusa o resto).
    canSchedule: hasPermission("VIEW_SCHEDULE") && can("agenda", "view"),
    canGym: hasPermission("VIEW_GYM") && can("financeiro.mensalidades", "view"),
    // Correio (B42): separador Emails da ficha — módulo VIEW_EMAIL + Caixa (Ver) + Clientes → Lista (Ver).
    canMail: hasPermission("VIEW_EMAIL") && can("correio.caixa", "view") && can("clientes.lista", "view"),
    canExport: can("clientes.lista.exportar", "edit"),
    canErase: can("clientes.lista.apagar", "edit"),
  };
}

export type ProfileTabId = "agenda" | "ginasio" | "emails";

/** Separadores da ficha completa (cada um só aparece com a permissão respectiva). */
export function profileTabsFor(a: Pick<CustomerAccess, "canSchedule" | "canGym" | "canMail">) {
  return [
    ...(a.canSchedule ? [{ id: "agenda" as const, label: "Agenda", icon: "calendar" }] : []),
    ...(a.canGym ? [{ id: "ginasio" as const, label: "Ginásio", icon: "euro" }] : []),
    ...(a.canMail ? [{ id: "emails" as const, label: "Emails", icon: "mail" }] : []),
  ];
}

type PaidFields = { paidAt?: string | null; paymentCash?: number | string | null; paymentMbway?: number | string | null; paymentCard?: number | string | null };

/** Valor pago a mostrar numa marcação do histórico: `null` sem valores, sem pagamento ou a zero. */
export function paidAmountToShow(a: PaidFields, showMoney: boolean): number | null {
  if (!showMoney || !a.paidAt) return null;
  const total = Number(a.paymentCash || 0) + Number(a.paymentMbway || 0) + Number(a.paymentCard || 0);
  return total > 0 ? total : null;
}
