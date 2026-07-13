/**
 * Fonte única dos SUBMENUS da sidebar (T1.1, `.design/shell-nav-perfil/`).
 *
 * Cada página com tabs de topo passa a ter uma entrada aqui: `path pai` →
 * lista de subitens `{ id, label, path, perm? }`. O `Shell.tsx` usa isto para
 * decidir (a) que itens mostrar como acordeão/flyout na sidebar, (b) o guard
 * de rotas (prefixo + redirect do subitem sem permissão), e (c) o título do
 * topbar para subpaths.
 *
 * Financeiro (T1.2, piloto), Loja (T2.1), Clientes (T2.2), Website (T2.3),
 * Admin (T2.4), Ginásio (T2.5), Agenda (T2.7) e Conteúdos (T2.6) já estão
 * migradas — as 8 páginas com tabs de topo do brief (`.design/shell-nav-perfil/
 * DESIGN_BRIEF.md`) estão todas neste mapa.
 */

export interface SubmenuItem {
  id: string;
  label: string;
  path: string;
  /**
   * Permissão(ões) exigida(s) para este subitem (ex.: VIEW_GYM). Sem perm =
   * sempre visível. Um array é OR — basta UMA das permissões (ex.: Website
   * "Template"/"Domínio", T3.8: `VIEW_SITE_BUILDER` OU `VIEW_ADMIN`).
   */
  perm?: string | string[];
}

export const SUBMENU: Record<string, SubmenuItem[]> = {
  "/financeiro": [
    { id: "negocio", label: "O Negócio", path: "/financeiro" },
    { id: "agenda", label: "Agenda", path: "/financeiro/agenda", perm: "VIEW_SCHEDULE" },
    { id: "loja", label: "Loja", path: "/financeiro/loja", perm: "VIEW_PRODUCTS" },
    { id: "ginasio", label: "Ginásio", path: "/financeiro/ginasio", perm: "VIEW_GYM" },
    { id: "despesas", label: "Despesas", path: "/financeiro/despesas" },
  ],
  "/loja": [
    { id: "produtos", label: "Produtos", path: "/loja" },
    { id: "encomendas", label: "Encomendas", path: "/loja/encomendas" },
    { id: "categorias", label: "Categorias", path: "/loja/categorias" },
  ],
  "/clientes": [
    // Label do âncora ("Lista", não "Clientes") por desenho — evita duplicar o
    // nome acessível do próprio item pai da sidebar quando o acordeão está
    // expandido (mesmo motivo por trás de "O Negócio"/"Produtos" acima).
    { id: "clientes", label: "Lista", path: "/clientes" },
    { id: "leads", label: "Leads", path: "/clientes/leads" },
  ],
  "/agenda": [
    // Label do âncora ("Calendário", não "Agenda") pelo mesmo motivo dos
    // outros grupos acima — e é também o nome mais preciso: a raiz É o
    // calendário, não um resumo genérico da página.
    { id: "cal", label: "Calendário", path: "/agenda" },
    { id: "marcacoes", label: "Marcações", path: "/agenda/marcacoes" },
    { id: "servicos", label: "Serviços", path: "/agenda/servicos" },
    { id: "config", label: "Configurações", path: "/agenda/config" },
  ],
  "/website": [
    // Label do âncora ("O meu site", não "Website") pelo mesmo motivo dos
    // outros grupos acima. A página nunca usou `?tab=` (sem deep-link legacy
    // a redirecionar aqui, T2.3).
    //
    // Gating por subitem (T3.8, `.design/site-tenant-light/DESIGN_BRIEF.md`
    // secção 3.8 — "feito por mim, afinado por eles"): o site é montado PELO
    // DONO por omissão; só quem tem `VIEW_SITE_BUILDER` (self-serve concede-a
    // automaticamente; contas montadas à mão pelo dono NÃO a têm por defeito,
    // ele atribui-a enquanto monta o site e revoga na entrega) OU
    // `VIEW_ADMIN` (o dono, sempre) vê Template/Domínio. "Páginas" fica
    // SEMPRE visível (sem `perm`) mas em MODO CONTEÚDO sem essa permissão —
    // ver `canEditStructure`/`PagesTab` em `Website.tsx`: o tenant tem de
    // conseguir editar textos/imagens dos blocos das páginas já montadas,
    // só não pode mexer na estrutura (criar/remover/reordenar páginas ou
    // blocos, mudar slug/variante). Mesmo padrão para o botão Publicar em
    // "O meu site" (`SiteStatusTab`).
    { id: "site", label: "O meu site", path: "/website" },
    { id: "template", label: "Template", path: "/website/template", perm: ["VIEW_SITE_BUILDER", "VIEW_ADMIN"] },
    { id: "pages", label: "Páginas", path: "/website/paginas" },
    { id: "brand", label: "Marca", path: "/website/marca" },
    { id: "footer", label: "Rodapé & Nav", path: "/website/rodape-nav" },
    { id: "domain", label: "Domínio", path: "/website/dominio", perm: ["VIEW_SITE_BUILDER", "VIEW_ADMIN"] },
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
    { id: "exercicios", label: "Exercícios", path: "/ginasio" },
    { id: "treinos", label: "Dia de Treino", path: "/ginasio/treinos" },
    { id: "planos", label: "Planos", path: "/ginasio/planos" },
    { id: "clientes", label: "Progresso de clientes", path: "/ginasio/clientes" },
  ],
  "/conteudos": [
    // Página com gating POR SUBITEM (T2.6): produtos/serviços/ginásio
    // continuam atrás das mesmas permissões que as tabs antigas do
    // `CMS_TABS` em `Conteudos.tsx` (VIEW_PRODUCTS/VIEW_SCHEDULE/VIEW_GYM) —
    // o `allowedSubitems`/guard do `Shell.tsx` fazem exatamente o que
    // `visibleTabs` fazia antes (filtrar + redirecionar para o 1.º
    // permitido). Nenhum destes 4 primeiros subitens pôde manter o nome
    // "óbvio" (Website/Loja/Agenda/Ginásio): colidiam com o nome acessível
    // dos itens homónimos da sidebar, sempre visíveis quando o subitem
    // também está — para produtos/serviços/ginásio a MESMA permissão que
    // gate o subitem gate também o item de módulo, por isso a colisão era
    // garantida; para o site público, o item `/website` é core (sempre
    // visível a qualquer tenant). Mesmo problema e solução do "Progresso de
    // clientes" no Ginásio (T2.5). (Deixou de ser a ÚNICA — `/website`
    // também gate por subitem desde T3.8, só que Template/Domínio, ver
    // `SUBMENU['/website']` acima.)
    { id: "website", label: "Site público", path: "/conteudos" },
    { id: "product", label: "Produtos", path: "/conteudos/produtos", perm: "VIEW_PRODUCTS" },
    { id: "service", label: "Serviços", path: "/conteudos/servicos", perm: "VIEW_SCHEDULE" },
    { id: "gym", label: "Ginásio (nomes)", path: "/conteudos/ginasio", perm: "VIEW_GYM" },
    { id: "linguas", label: "Línguas", path: "/conteudos/linguas" },
    { id: "emails", label: "Emails", path: "/conteudos/emails" },
    { id: "notificacoes", label: "Notificações", path: "/conteudos/notificacoes" },
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
