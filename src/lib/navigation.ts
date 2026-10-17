/**
 * Fonte única dos SUBMENUS da sidebar (T1.1, `.design/shell-nav-perfil/`).
 *
 * Cada página com tabs de topo passa a ter uma entrada aqui: `path pai` →
 * lista de subitens `{ id, label, path, perm? }`. O `Shell.tsx` usa isto para
 * decidir (a) que itens mostrar como acordeão/flyout na sidebar, (b) o guard
 * de rotas (prefixo + redirect do subitem sem permissão), e (c) o título do
 * topbar para subpaths.
 *
 * Financeiro (T1.2, piloto), Loja (T2.1), Clientes (T2.2), Admin (T2.4),
 * Ginásio (T2.5), Agenda (T2.7) e Conteúdos (T2.6) já estão migradas — as
 * páginas com tabs de topo do brief (`.design/shell-nav-perfil/
 * DESIGN_BRIEF.md`) estão todas neste mapa.
 */

export interface SubmenuItem {
  id: string;
  label: string;
  path: string;
  /**
   * Permissão(ões) exigida(s) para este subitem (ex.: VIEW_GYM). Sem perm =
   * sempre visível. Um array é OR — basta UMA das permissões.
   */
  perm?: string | string[];
  /**
   * Equipa (B41 2b): folha(s) da árvore de permissões que dão este subitem a um MEMBRO (OU se for um array;
   * basta `view`). O dono nunca olha para isto — vale `perm`. Um subitem sem `leaf` nem `ownerOnly` não
   * aparece a membros (default-deny).
   */
  leaf?: string | string[];
  /** Equipa: nunca aparece a um membro (agrega dinheiro de vários módulos — fase 2c). */
  ownerOnly?: boolean;
}

export const SUBMENU: Record<string, SubmenuItem[]> = {
  "/financeiro": [
    { id: "negocio", label: "O Negócio", path: "/financeiro", ownerOnly: true },
    { id: "agenda", label: "Agenda", path: "/financeiro/agenda", perm: "VIEW_SCHEDULE", ownerOnly: true },
    { id: "loja", label: "Loja", path: "/financeiro/loja", perm: "VIEW_PRODUCTS", ownerOnly: true },
    { id: "ginasio", label: "Ginásio", path: "/financeiro/ginasio", perm: "VIEW_GYM", leaf: "financeiro.mensalidades" },
    // `VIEW_EXPENSES` acrescentado (B5): esta aba lê/escreve `/expenses`, que a
    // API gateia por essa permissão (routes/index.ts). Sem `perm` aqui, um
    // tenant criado pelo admin sem essa permissão via o subitem, entrava e
    // levava 403 em todos os hooks — `Despesas.tsx` não tratava `isError`.
    { id: "despesas", label: "Despesas", path: "/financeiro/despesas", perm: "VIEW_EXPENSES", leaf: "financeiro.despesas" },
  ],
  "/loja": [
    { id: "produtos", label: "Produtos", path: "/loja", leaf: "loja.produtos" },
    { id: "encomendas", label: "Encomendas", path: "/loja/encomendas", leaf: "loja.encomendas" },
    { id: "categorias", label: "Categorias", path: "/loja/categorias", leaf: "loja.categorias" },
  ],
  "/clientes": [
    // Label do âncora ("Lista", não "Clientes") por desenho — evita duplicar o
    // nome acessível do próprio item pai da sidebar quando o acordeão está
    // expandido (mesmo motivo por trás de "O Negócio"/"Produtos" acima).
    //
    // `VIEW_CUSTOMERS` acrescentado a AMBOS os subitens (B5): tanto `/customers`
    // como `/leads` exigem essa permissão na API (routes/index.ts) — um tenant
    // criado pelo admin sem ela via o item "Clientes" na sidebar (é core,
    // sempre visível) e levava "Erro ao carregar clientes" ao entrar. Como não
    // há aqui nenhum subitem sem `perm` a servir de fallback (ao contrário do
    // Financeiro/Conteúdos), o guard do `Shell.tsx` trata a raiz inteira como
    // indisponível quando `allowedSubitems` devolve vazio, e cai para o
    // dashboard — não fica preso a mostrar um erro.
    { id: "clientes", label: "Lista", path: "/clientes", perm: "VIEW_CUSTOMERS", leaf: "clientes.lista" },
    { id: "leads", label: "Leads", path: "/clientes/leads", perm: "VIEW_CUSTOMERS", leaf: "clientes.leads" },
  ],
  "/agenda": [
    // Label do âncora ("Calendário", não "Agenda") pelo mesmo motivo dos
    // outros grupos acima — e é também o nome mais preciso: a raiz É o
    // calendário, não um resumo genérico da página.
    { id: "cal", label: "Calendário", path: "/agenda", leaf: "agenda.marcacoes" },
    { id: "marcacoes", label: "Marcações", path: "/agenda/marcacoes", leaf: "agenda.marcacoes" },
    { id: "servicos", label: "Serviços", path: "/agenda/servicos", leaf: "agenda.servicos" },
    { id: "config", label: "Configurações", path: "/agenda/config", leaf: ["agenda.config", "agenda.bloqueios"] },
  ],
  "/admin": [
    // Label do âncora ("Utilizadores", não "Admin") pelo mesmo motivo dos
    // outros grupos acima. Sem `?tab=` legacy a redirecionar aqui — o único
    // deep-link real desta página é o retorno do OAuth do Google
    // (`/admin?google=connected|error`), tratado à parte no `AdminEntry`
    // (App.tsx), não por `resolveLegacyTabTarget`.
    { id: "utilizadores", label: "Utilizadores", path: "/admin" },
    { id: "permissoes", label: "Permissões", path: "/admin/permissoes" },
    { id: "componentes", label: "Componentes", path: "/admin/componentes" },
    { id: "tokens", label: "Tokens de site", path: "/admin/tokens" },
    { id: "dominios", label: "Domínios permitidos", path: "/admin/dominios" },
    { id: "faturacao", label: "Faturação", path: "/admin/faturacao" },
    { id: "integracoes", label: "Integrações", path: "/admin/integracoes" },
    { id: "atividade", label: "Atividade", path: "/admin/atividade" },
    { id: "sistema", label: "Sistema", path: "/admin/sistema" },
  ],
  "/ginasio": [
    // Label do âncora ("Exercícios", não "Ginásio") pelo mesmo motivo dos
    // outros grupos acima. O último subitem NÃO se chama "Clientes": esse
    // nome já é o do item core `/clientes` da sidebar — com o grupo Ginásio
    // expandido (rota `/ginasio/*`) os dois botões coexistiriam no `<nav>` e
    // colidiriam em qualquer `getByRole("button", { name: "Clientes" })`
    // (ex.: a matriz RBAC navega para `/ginasio` antes de asserir "Clientes"
    // core visível). O conteúdo real da tab é atribuir/mudar planos e ver a
    // adesão/progresso de cada cliente — não uma lista de clientes por si só
    // — daí "Progresso de clientes", mais preciso e sem ambiguidade.
    { id: "exercicios", label: "Exercícios", path: "/ginasio", leaf: "ginasio.exercicios" },
    { id: "treinos", label: "Dia de Treino", path: "/ginasio/treinos", leaf: "ginasio.treinos" },
    { id: "planos", label: "Planos", path: "/ginasio/planos", leaf: "ginasio.treinos" },
    { id: "clientes", label: "Progresso de clientes", path: "/ginasio/clientes", leaf: "ginasio.clientes" },
  ],
  "/conteudos": [
    // Página com gating POR SUBITEM (T2.6): produtos/serviços/ginásio
    // continuam atrás das mesmas permissões que as tabs antigas do
    // `CMS_TABS` em `Conteudos.tsx` (VIEW_PRODUCTS/VIEW_SCHEDULE/VIEW_GYM) —
    // o `allowedSubitems`/guard do `Shell.tsx` fazem exatamente o que
    // `visibleTabs` fazia antes (filtrar + redirecionar para o 1.º
    // permitido). Produtos/Serviços/Ginásio (nomes) não podem ter o nome
    // "óbvio" (Loja/Agenda/Ginásio): colidiam com o nome acessível dos itens
    // de módulo homónimos da sidebar — a MESMA permissão gate o subitem e o
    // módulo, por isso a colisão é garantida. Mesmo problema e solução do
    // "Progresso de clientes" no Ginásio (T2.5). "Website" já pode: este
    // subitem chamava-se "Site público" enquanto existia o item "Website"
    // (`/website`) na sidebar, que saiu no B35.
    // `VIEW_CMS` acrescentado em 2026-09-24: esta aba lê e escreve `/cms/entries`,
    // que a API gateia por essa permissão (routes/index.ts). Sem `perm` aqui, um
    // utilizador sem VIEW_CMS via a aba e levava 403 ao abri-la — não perde
    // capacidade nenhuma com isto, deixa só de ver uma porta fechada.
    //
    // ⚠ NÃO acrescentar o mesmo a "Emails"/"Notificações": esses lêem
    // `/cms/{email,notification}-templates`, que exigem só sessão iniciada. A UI
    // e a API concordam aí de propósito — são dados de referência, como Línguas.
    { id: "website", label: "Website", path: "/conteudos", perm: "VIEW_CMS", leaf: "conteudos.website" },
    { id: "product", label: "Produtos", path: "/conteudos/produtos", perm: "VIEW_PRODUCTS", leaf: "conteudos.produtos" },
    { id: "service", label: "Serviços", path: "/conteudos/servicos", perm: "VIEW_SCHEDULE", leaf: "conteudos.servicos" },
    { id: "gym", label: "Ginásio (nomes)", path: "/conteudos/ginasio", perm: "VIEW_GYM", leaf: "conteudos.ginasio" },
    { id: "linguas", label: "Línguas", path: "/conteudos/linguas", leaf: "conteudos.linguas" },
    { id: "emails", label: "Emails", path: "/conteudos/emails", leaf: "conteudos.emails" },
    { id: "notificacoes", label: "Notificações", path: "/conteudos/notificacoes", leaf: "conteudos.notificacoes" },
  ],
};

/** Subitens de `root` que o tenant pode ver, pela mesma semântica de gating das tabs antigas. */
export function allowedSubitems(root: string, hasPermission: (name: string) => boolean): SubmenuItem[] {
  const items = SUBMENU[root];
  if (!items) return [];
  return items.filter((it) => {
    if (!it.perm) return true;
    const perms = Array.isArray(it.perm) ? it.perm : [it.perm];
    return perms.some((p) => hasPermission(p));
  });
}

/**
 * Path pai (raiz) a que `pathname` pertence, dentro do conjunto de rotas
 * acessíveis — ou `undefined` se não pertencer a nenhuma (rota desconhecida
 * ou não acessível ao tenant). `pathname === p` cobre a rota-raiz em si;
 * `pathname.startsWith(p + "/")` cobre qualquer subpath.
 */
export function findRoot(pathname: string, accessiblePaths: string[]): string | undefined {
  return accessiblePaths.find((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Resolve o alvo de um redirect de deep-link legacy `?<param>=<id>` (T1.2
 * piloto Financeiro, generalizado no T2.1 para as restantes páginas com
 * submenu da Fase 2). `id` tem de ser um subitem REAL de `SUBMENU[root]` cujo
 * path não seja o da própria raiz — o id-âncora da raiz (ex.: "negocio" no
 * Financeiro, "produtos" na Loja) nunca gera redirect, porque o seu path já É
 * a raiz (ficar lá não é um redirect). `restSearch` são os restantes query
 * params já serializados (sem o `<param>` legacy) — preservados no destino
 * (ex.: `?openProduct=` sobrevive a `?tab=encomendas&openProduct=`). Devolve
 * `null` quando não há nada a redirecionar (sem valor, id desconhecido, ou
 * id-âncora) — quem chama fica responsável por renderizar o conteúdo por
 * defeito da raiz nesse caso.
 */
export function resolveLegacyTabTarget(root: string, id: string | null, restSearch: string): string | null {
  if (!id) return null;
  const item = (SUBMENU[root] ?? []).find((it) => it.id === id && it.path !== root);
  if (!item) return null;
  return `${item.path}${restSearch ? `?${restSearch}` : ""}`;
}

/**
 * Equipa (B41 2b): subitens que um MEMBRO vê — por folha da árvore (`can(leaf, 'view')`), nunca por `perm` (o
 * tecto do tenant já vem nas folhas que a API devolve). Sem `leaf` ou `ownerOnly` → escondido (default-deny).
 * Uma raiz sem SUBMENU (Mensagens, Estatísticas, Páginas) não passa por aqui: vê-se pela folha do topo.
 */
export function memberSubitems(root: string, can: (key: string, level?: "view" | "edit") => boolean): SubmenuItem[] {
  const items = SUBMENU[root];
  if (!items) return [];
  return items.filter((it) => {
    if (it.ownerOnly || !it.leaf) return false;
    const leaves = Array.isArray(it.leaf) ? it.leaf : [it.leaf];
    return leaves.some((l) => can(l, "view"));
  });
}

/**
 * Equipa (B41 2b): a FOLHA da árvore a que cada página/separador pertence — é o que o `useWriteGuard` usa para
 * saber se o membro só pode VER a página em que está. Prefixo mais longo ganha. Uma página que mistura folhas
 * (Configurações = `agenda.config` + `agenda.bloqueios`; Produtos com o custo; a ficha de cliente com
 * apagar/exportar) guarda pela folha principal aqui e usa `can()`/`leaf` directo nos controlos que são de outra.
 * `/despesas` e `/financeiro/despesas` são a mesma folha.
 */
export const LEAF_FOR_PATH: ReadonlyArray<readonly [string, string]> = [
  ["/agenda/servicos", "agenda.servicos"],
  ["/agenda/config", "agenda.config"],
  ["/agenda/marcacoes", "agenda.marcacoes"],
  ["/agenda", "agenda.marcacoes"],
  ["/loja/encomendas", "loja.encomendas"],
  ["/loja/categorias", "loja.categorias"],
  ["/loja", "loja.produtos"],
  ["/ginasio/treinos", "ginasio.treinos"],
  ["/ginasio/planos", "ginasio.treinos"],
  ["/ginasio/clientes", "ginasio.clientes"],
  ["/ginasio", "ginasio.exercicios"],
  ["/clientes/leads", "clientes.leads"],
  ["/clientes", "clientes.lista"],
  ["/financeiro/ginasio", "financeiro.mensalidades"],
  ["/financeiro/despesas", "financeiro.despesas"],
  ["/despesas", "financeiro.despesas"],
  ["/conteudos/produtos", "conteudos.produtos"],
  ["/conteudos/servicos", "conteudos.servicos"],
  ["/conteudos/ginasio", "conteudos.ginasio"],
  ["/conteudos/linguas", "conteudos.linguas"],
  ["/conteudos/emails", "conteudos.emails"],
  ["/conteudos/notificacoes", "conteudos.notificacoes"],
  ["/conteudos", "conteudos.website"],
  ["/paginas", "paginas.rascunho"],
  ["/mensagens", "mensagens"],
  ["/estatisticas", "estatisticas"],
];

/** Folha da árvore a que `pathname` pertence, ou `undefined` (Dashboard, Perfil, Equipa, …). */
export function leafForPath(pathname: string): string | undefined {
  for (const [prefix, leaf] of LEAF_FOR_PATH) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return leaf;
  }
  return undefined;
}

/** Topo da árvore (`agenda`, `loja`, …) a que `pathname` pertence — o primeiro segmento da folha. */
export function moduleForPath(pathname: string): string | undefined {
  const leaf = leafForPath(pathname);
  return leaf ? leaf.split(".")[0] : undefined;
}
