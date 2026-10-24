// Que itens de topo da barra lateral cada sessão vê. Só apresentação: a API decide (guards e folhas) e continua a recusar.

// Core: todos os tenants (donos) têm, sem permissão de módulo. As Estatísticas NÃO são core (ES-13): a API pede a folha
// `estatisticas` (requireGrant), por isso o dono vê sempre o item e um membro só com a folha.
const OWNER_CORE_PATHS = ['/clientes', '/mensagens', '/financeiro', '/conteudos', '/estatisticas', '/faturacao']

// Módulos do tenant (permissões VIEW_*), só para o dono.
const MODULE_PERM_TO_PATH: Record<string, string> = {
  VIEW_SCHEDULE: '/agenda',
  VIEW_PRODUCTS: '/loja',
  VIEW_GYM: '/ginasio',
  // Construtor de páginas (B38): item de topo próprio, só com a permissão.
  VIEW_SITE_PAGES: '/paginas',
  // Correio (B42): o módulo de email.
  VIEW_EMAIL: '/correio',
}

// Equipa (B41): o TOPO da árvore da API → item da sidebar (`can(topo)` = alguma folha debaixo). A Faturação é só do dono.
const MEMBER_MODULE_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  loja: '/loja',
  ginasio: '/ginasio',
  clientes: '/clientes',
  financeiro: '/financeiro',
  conteudos: '/conteudos',
  paginas: '/paginas',
  estatisticas: '/estatisticas',
  // Agrupador (B43): `can('mensagens')` = alguma das folhas clientes/equipa/suporte.
  mensagens: '/mensagens',
  // Correio (B42): `can('correio')` = alguma das folhas (hoje `correio.caixa`).
  correio: '/correio',
}

export function accessiblePaths(o: {
  isMember: boolean
  isAdmin: boolean
  can: (key: string) => boolean
  permissionNames: string[]
  personalMailbox: boolean
}): Set<string> {
  if (o.isMember) {
    return new Set<string>([
      ...Object.entries(MEMBER_MODULE_PATH).filter(([key]) => o.can(key)).map(([, path]) => path),
      // CR-09/CR-07: a caixa pessoal de um membro é sempre dele, com o módulo Correio no negócio.
      ...(o.personalMailbox ? ['/correio'] : []),
    ])
  }
  return new Set<string>([
    '/dashboard',
    ...o.permissionNames.map((n) => MODULE_PERM_TO_PATH[n]).filter(Boolean),
    ...OWNER_CORE_PATHS,
    ...(o.isAdmin ? ['/admin'] : []),
  ])
}
