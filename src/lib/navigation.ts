/**
 * Fonte única dos SUBMENUS da sidebar (T1.1, `.design/shell-nav-perfil/`).
 *
 * Cada página com tabs de topo passa a ter uma entrada aqui: `path pai` →
 * lista de subitens `{ id, label, path, perm? }`. O `Shell.tsx` usa isto para
 * decidir (a) que itens mostrar como acordeão/flyout na sidebar, (b) o guard
 * de rotas (prefixo + redirect do subitem sem permissão), e (c) o título do
 * topbar para subpaths.
 *
 * Financeiro (T1.2, piloto), Loja (T2.1), Clientes (T2.2), Website (T2.3) e
 * Agenda (T2.7) já estão migradas — as restantes páginas com tabs (Admin,
 * Ginásio, Conteúdos) entram na Fase 2, uma de cada vez, cada uma
 * acrescentando a sua entrada a este mapa.
 */

export interface SubmenuItem {
  id: string;
  label: string;
  path: string;
  /** Permissão exigida para este subitem (ex.: VIEW_GYM). Sem perm = sempre visível. */
  perm?: string;
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
    { id: "site", label: "O meu site", path: "/website" },
    { id: "template", label: "Template", path: "/website/template" },
    { id: "pages", label: "Páginas", path: "/website/paginas" },
    { id: "brand", label: "Marca", path: "/website/marca" },
    { id: "footer", label: "Rodapé & Nav", path: "/website/rodape-nav" },
    { id: "domain", label: "Domínio", path: "/website/dominio" },
  ],
};

/** Subitens de `root` que o tenant pode ver, pela mesma semântica de gating das tabs antigas. */
export function allowedSubitems(root: string, hasPermission: (name: string) => boolean): SubmenuItem[] {
  const items = SUBMENU[root];
  if (!items) return [];
  return items.filter((it) => !it.perm || hasPermission(it.perm));
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
