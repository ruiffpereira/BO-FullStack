/**
 * Chaves de React Query dos hooks ESCRITOS À MÃO (os do Kubb têm `get…QueryKey()` em `src/gen` — usar essas).
 * Um só módulo: quem consulta e quem invalida (`invalidateMoney`, SSE, painéis) importam daqui, nunca um literal.
 */
export const queryKeys = {
  dashboard: {
    root: ['dashboard'] as const,
    of: (period: string, customStart: string | undefined, customEnd: string | undefined, staff?: string) =>
      ['dashboard', period, customStart, customEnd, staff ?? 'all'] as const,
  },
  financeiro: {
    root: ['financeiro'] as const,
    of: (path: string, period: string, iva: string, customStart: string | undefined, customEnd: string | undefined, staff?: string) =>
      ['financeiro', path, period, iva, customStart, customEnd, staff ?? 'all'] as const,
  },
  gymAnalytics: ['/gym/mensalidade/analytics'] as const,
  emailTemplates: ['email-templates'] as const,
  notificationTemplates: ['notification-templates'] as const,
  cmsReferences: (key: string | null) => ['cms-references', key] as const,
  cmsReferencesCounts: {
    root: ['cms-references-counts'] as const,
    of: (keys: string[]) => ['cms-references-counts', keys.slice().sort().join(',')] as const,
  },
  auditLogs: (filters: unknown) => ['audit-logs', filters] as const,
  health: ['health'] as const,
  chat: {
    all: ['chat'] as const,
    support: ['chat', 'support'] as const,
    usersPicker: ['chat', 'users-picker'] as const,
    adminConversationsRoot: ['chat', 'admin', 'conversations'] as const,
    adminConversations: (search?: string) => ['chat', 'admin', 'conversations', search ?? ''] as const,
    adminThread: (tenantUserId: string) => ['chat', 'admin', 'thread', tenantUserId] as const,
  },
}
