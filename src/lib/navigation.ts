/**
 * Fonte única dos SUBMENUS da sidebar (T1.1, `.design/shell-nav-perfil/`).
 *
 * Cada página com tabs de topo passa a ter uma entrada aqui: `path pai` →
 * lista de subitens `{ id, label, path, perm? }`. O `Shell.tsx` usa isto para
 * decidir (a) que itens mostrar como acordeão/flyout na sidebar, (b) o guard
 * de rotas (prefixo + redirect do subitem sem permissão), e (c) o título do
 * topbar para subpaths.
 *
 * Nesta fase só o Financeiro está migrado (T1.2, piloto) — as restantes
 * páginas com tabs (Loja, Clientes, Website, Admin, Ginásio, Conteúdos,
 * Agenda) entram na Fase 2, uma de cada vez, cada uma acrescentando a sua
 * entrada a este mapa.
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
