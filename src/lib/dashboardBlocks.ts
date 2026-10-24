/**
 * Blocos do Dashboard (B41 fase 2c) — lógica PURA, sem React.
 *
 * A API devolve `included: string[]` com os blocos a que a sessão tem acesso; um bloco/campo ausente é SEM ACESSO,
 * nunca 0. O dono recebe tudo o que o tenant tem (as permissões `VIEW_*` do tenant continuam a ser o critério).
 * O Backoffice nunca calcula acessos: lê `included` (membro) ou as permissões do tenant (dono).
 */

export interface DashboardBlocks {
  /** Marcações (agenda.marcacoes). */
  schedule: boolean
  /** Receitas/faturação da agenda (agenda.marcacoes.valores). */
  scheduleValues: boolean
  /** Encomendas da loja (loja.encomendas). */
  orders: boolean
  /** Stock da loja (loja.produtos). */
  stock: boolean
  /** Clientes (clientes.lista). */
  customers: boolean
  /** Mensalidades do ginásio (financeiro.mensalidades). */
  gymRevenue: boolean
  /** Sócios do ginásio (ginasio.clientes). */
  gymMembers: boolean
  /** Despesas (financeiro.despesas). */
  expenses: boolean
}

export type DashboardSpine = 'agenda' | 'gym' | 'loja' | 'core' | 'none'

export interface TenantPerms {
  schedule: boolean
  products: boolean
  gym: boolean
  /** `VIEW_CUSTOMERS`: sem ela `GET /customers` dá 403 e o cartão «Clientes» nem deve existir. Omitido = como sempre (core). */
  customers?: boolean
}

/** Tudo fechado — o estado de um membro enquanto o `/dashboard` ainda não respondeu. */
export const NO_BLOCKS: DashboardBlocks = {
  schedule: false, scheduleValues: false, orders: false, stock: false,
  customers: false, gymRevenue: false, gymMembers: false, expenses: false,
}

export function dashboardBlocks(opts: {
  isMember: boolean
  included?: readonly string[] | null
  perms: TenantPerms
}): DashboardBlocks {
  const { isMember, included, perms } = opts
  if (!isMember) {
    // Dono: como sempre — os módulos do tenant; Clientes é core.
    return {
      schedule: perms.schedule, scheduleValues: perms.schedule,
      orders: perms.products, stock: perms.products,
      customers: perms.customers ?? true,
      gymRevenue: perms.gym, gymMembers: perms.gym,
      expenses: true,
    }
  }
  if (!included) return NO_BLOCKS
  const has = (k: string) => included.includes(k)
  return {
    schedule: has('schedule'),
    scheduleValues: has('schedule.valores'),
    orders: has('ecommerce.orders'),
    stock: has('ecommerce.stock'),
    customers: has('ecommerce.customers'),
    gymRevenue: has('gym.revenue'),
    gymMembers: has('gym.members'),
    expenses: has('expenses'),
  }
}

/** Há alguma fonte de receita visível? (senão o cartão "Receita de hoje" não existe — nunca "€0"). */
export function hasRevenue(b: DashboardBlocks): boolean {
  return b.scheduleValues || b.orders || b.gymRevenue
}

/** "agenda + loja + ginásio" — só as fontes que entram na soma. */
export function revenueSourcesLabel(b: DashboardBlocks): string {
  const parts: string[] = []
  if (b.scheduleValues) parts.push('agenda')
  if (b.orders) parts.push('loja')
  if (b.gymRevenue) parts.push('ginásio')
  return parts.join(' + ')
}

/** Peça central do ecrã, por prioridade operacional; `none` quando não sobra nenhuma (o resto vai para o carril). */
export function dashboardSpine(b: DashboardBlocks): DashboardSpine {
  if (b.schedule) return 'agenda'
  if (b.gymRevenue) return 'gym'
  if (b.orders) return 'loja'
  if (b.customers) return 'core'
  return 'none'
}

/** Há algum conteúdo para mostrar? */
export function hasAnyBlock(b: DashboardBlocks): boolean {
  return Object.values(b).some(Boolean)
}
