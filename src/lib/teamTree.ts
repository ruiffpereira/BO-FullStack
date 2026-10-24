/**
 * Árvore de permissões da equipa (B41 fase 2b) — lógica PURA, sem React.
 *
 * Duas coisas vivem aqui:
 *  1. `canFromGrants` — a pergunta "esta sessão pode `key` ao nível `level`?" sobre as folhas efectivas que a API
 *     devolve em `GET /user-permissions/access`. O Backoffice nunca decide permissões: só LÊ o que a API deu.
 *  2. A edição da árvore da página Equipa — marcar pai/filho, estado parcial, tecto de nível, acesso total e a
 *     serialização (só os nós `storable`). Espelha as regras que a API valida (`validateGrants`), para o
 *     utilizador nunca chegar a um 422.
 */

import { FEATURES } from "./features";

export type TeamLevel = "view" | "edit";

export interface TreeNode {
  key: string;
  label: string;
  levels: TeamLevel[];
  action: boolean;
  storable: boolean;
  requiresComponents?: string[];
  available: boolean;
  /** Fase 3: o "Acesso total" não inclui este nó (ex. `equipa`). */
  excludeFromFullAccess?: boolean;
  /** Fase 3: rótulos de nível para mostrar (ex. `{ edit: "Gerir" }`). */
  levelLabels?: Partial<Record<TeamLevel, string>>;
  /** Fase 3: o máximo que QUEM PEDE pode dar neste nó (`null` = nada). Omitido = sem tecto (dono). */
  maxLevel?: TeamLevel | null;
  /** Profissionais: o nó aceita o âmbito [Todos | Só os meus]. */
  scoped?: boolean;
  /** Profissionais: `"meus"` = quem edita só tem «Só os meus» neste nó, por isso só pode dar esse âmbito. */
  maxScope?: "meus" | null;
  children: TreeNode[];
}

export interface GrantEntry {
  key: string;
  level: TeamLevel;
  /** Só vai quando é `"meus"`; ausente = Todos. */
  scope?: "meus";
}

/** Âmbito de um nó `scoped`: só `"meus"` se guarda — ausente = Todos (o que os membros antigos já têm). */
export type ScopeMap = Record<string, "meus">;
export type TeamScope = "todos" | "meus";
export const SCOPE_LABEL: Record<TeamScope, string> = { todos: "Todos", meus: "Só os meus" };

/** Mapa chave → nível das folhas escolhidas (só nós `storable`). */
export type GrantMap = Record<string, TeamLevel>;

/* ───────────────────────── can() sobre as folhas efectivas ───────────────────────── */

/**
 * Pode `key` ao nível pedido?
 *  - `key` é uma folha guardável com grant → decide o nível dessa folha (um filho-acção com `edit` não eleva o pai);
 *  - `key` é um agrupador / topo (`agenda`) ou uma folha sem grant → basta ALGUMA folha debaixo dele ao nível pedido.
 * `edit` implica `view`. Sem grants → falso.
 */
export function canFromGrants(grants: readonly GrantEntry[], key: string, level: TeamLevel = "view"): boolean {
  const ok = (g: GrantEntry) => level === "view" || g.level === "edit";
  const exact = grants.find((g) => g.key === key);
  if (exact) return ok(exact);
  const prefix = `${key}.`;
  return grants.some((g) => g.key.startsWith(prefix) && ok(g));
}

/** Alguma das chaves? (OU) */
export function canAnyFromGrants(grants: readonly GrantEntry[], keys: readonly string[], level: TeamLevel = "view"): boolean {
  return keys.some((k) => canFromGrants(grants, k, level));
}

/* ───────────────────────── Árvore: índices ───────────────────────── */

export interface FlatInfo {
  node: TreeNode;
  /** Chave do pai directo (qualquer nó) ou null no topo. */
  parent: string | null;
  /** Chave do antepassado `storable` mais próximo (null = nenhum). */
  storableParent: string | null;
}

export function indexTree(tree: readonly TreeNode[]): Map<string, FlatInfo> {
  const out = new Map<string, FlatInfo>();
  const walk = (nodes: readonly TreeNode[], parent: TreeNode | null, storableParent: string | null) => {
    for (const n of nodes) {
      out.set(n.key, { node: n, parent: parent?.key ?? null, storableParent });
      walk(n.children ?? [], n, n.storable ? n.key : storableParent);
    }
  };
  walk(tree, null, null);
  return out;
}

export const maxLevelOf = (n: TreeNode): TeamLevel => (n.levels.includes("edit") ? "edit" : "view");

/** O nó e todos os descendentes, em ordem. */
export function subtreeOf(n: TreeNode): TreeNode[] {
  const out: TreeNode[] = [n];
  for (const c of n.children ?? []) out.push(...subtreeOf(c));
  return out;
}

/** Nós seleccionáveis do ramo: guardáveis, disponíveis no plano e que quem edita pode dar (`maxLevel !== null`). */
const selectable = (n: TreeNode) => n.storable && n.available && n.maxLevel !== null;

/** Texto do tooltip dos nós que quem edita não pode dar. */
export const CANNOT_GIVE_MESSAGE = "Só podes dar o que tens";

/** Nível máximo que quem edita pode dar neste nó (cruza o que o nó permite com o `maxLevel`). */
export function giveLevelOf(n: TreeNode): TeamLevel | null {
  if (n.maxLevel === null) return null;
  const own = maxLevelOf(n);
  return own === "edit" && n.maxLevel === "view" && n.levels.includes("view") ? "view" : own;
}

/** Há nós que quem edita não pode dar (ou só ao nível "ver")? — para mostrar o motivo como texto (o tooltip não existe em ecrãs táteis). */
export function hasLimitedNodes(tree: TreeNode[]): boolean {
  return tree.some(
    (n) =>
      (n.storable && n.available && giveLevelOf(n) !== maxLevelOf(n)) ||
      (n.storable && n.available && !!n.scoped && n.maxScope === "meus") ||
      hasLimitedNodes(n.children ?? []),
  );
}

/** Âmbito efectivo de um nó: o escolhido, ou `meus` à força quando quem edita não pode dar «Todos». */
export function scopeOf(n: Pick<TreeNode, "maxScope">, scopes: ScopeMap, key: string): TeamScope {
  return n.maxScope === "meus" || scopes[key] === "meus" ? "meus" : "todos";
}

/** Quem edita pode dar «Todos» neste nó? (`maxScope: "meus"` = não.) */
export const canGiveAllScope = (n: Pick<TreeNode, "maxScope">) => n.maxScope !== "meus";

/** Muda o âmbito de um nó (recusa «Todos» onde quem edita só tem «Só os meus»). */
export function setNodeScope(tree: readonly TreeNode[], key: string, scope: TeamScope, scopes: ScopeMap): ScopeMap {
  const n = indexTree(tree).get(key)?.node;
  if (!n || !n.scoped) return scopes;
  if (scope === "todos" && !canGiveAllScope(n)) return scopes;
  const next = { ...scopes };
  if (scope === "meus") next[key] = "meus";
  else delete next[key];
  return next;
}

/**
 * Alinha os âmbitos com as folhas marcadas: só nós `scoped` marcados têm âmbito, e onde quem edita só tem
 * «Só os meus» ele fica forçado a `meus`.
 */
export function normalizeScopes(tree: readonly TreeNode[], grants: GrantMap, scopes: ScopeMap): ScopeMap {
  const out: ScopeMap = {};
  for (const top of tree) {
    for (const n of subtreeOf(top)) {
      if (!n.scoped || !n.storable || grants[n.key] === undefined) continue;
      if (scopeOf(n, scopes, n.key) === "meus") out[n.key] = "meus";
    }
  }
  return out;
}

/** Âmbitos devolvidos pela API (`grants[].scope`) → mapa (só nós `scoped`). */
export function scopesToMap(
  tree: readonly TreeNode[],
  list: ReadonlyArray<{ key?: string; scope?: string }> | undefined | null,
): ScopeMap {
  const idx = indexTree(tree);
  const out: ScopeMap = {};
  for (const e of list ?? []) {
    const n = e.key ? idx.get(e.key)?.node : undefined;
    if (n?.scoped && e.scope === "meus") out[n.key] = "meus";
  }
  return out;
}

/** Rótulo de um nível num nó (`levelLabels` da API, ou "Ver" / "Editar"). */
export function levelLabel(n: Pick<TreeNode, "levelLabels">, level: TeamLevel): string {
  return n.levelLabels?.[level] ?? (level === "view" ? "Ver" : "Editar");
}

/**
 * Nós escondidos por `FEATURES` (dono 2026-10-24: Campanhas): não aparecem na árvore nem no convite, mas os nós e as
 * permissões já guardadas ficam intactos (o mapa de grants não os perde ao gravar).
 */
export function isFeatureHiddenNode(key: string): boolean {
  return !FEATURES.campaigns && (key === "correio.campanhas" || key.startsWith("correio.campanhas."));
}

/**
 * A árvore que o editor mostra: sem os nós que o plano do tenant não inclui (`available: false`) — decisão do dono,
 * não aparecem de todo — e sem os agrupadores que fiquem sem nada seleccionável debaixo.
 */
export function visibleTree(tree: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of tree) {
    if (!n.available || isFeatureHiddenNode(n.key)) continue;
    const children = visibleTree(n.children ?? []);
    if (!n.storable && children.length === 0) continue;
    out.push({ ...n, children });
  }
  return out;
}

/* ───────────────────────── Estado de uma caixa ───────────────────────── */

export type CheckState = "on" | "partial" | "off";

/**
 * on = todos os nós seleccionáveis do ramo estão marcados; off = nenhum; partial = alguns.
 * Um ramo sem nada seleccionável (tudo indisponível) é `off`.
 */
export function checkState(n: TreeNode, grants: GrantMap): CheckState {
  const sel = subtreeOf(n).filter(selectable);
  if (sel.length === 0) return "off";
  const marked = sel.filter((x) => grants[x.key] !== undefined).length;
  if (marked === 0) return "off";
  return marked === sel.length ? "on" : "partial";
}

/* ───────────────────────── Edição ───────────────────────── */

const clone = (g: GrantMap): GrantMap => ({ ...g });

/**
 * Acrescenta os antepassados guardáveis que faltam (nível suficiente para o filho; acções só precisam de existir).
 * NUNCA sobe o nível de um antepassado que já está marcado: é o filho que se limita ao pai.
 */
function ensureAncestors(idx: Map<string, FlatInfo>, key: string, childLevel: TeamLevel, isAction: boolean, g: GrantMap) {
  let p = idx.get(key)?.storableParent ?? null;
  let need: TeamLevel = isAction ? "view" : childLevel;
  while (p) {
    if (!g[p]) g[p] = need;
    need = g[p];
    p = idx.get(p)!.storableParent;
  }
}

/** Nível do pai guardável mais próximo (o tecto do filho). Pai ausente = `edit` (será acrescentado). */
function ceilingFor(idx: Map<string, FlatInfo>, key: string, g: GrantMap): TeamLevel {
  const p = idx.get(key)?.storableParent;
  return p && g[p] ? g[p] : "edit";
}

/**
 * Marca (ou desmarca) um nó e o seu ramo.
 *  - se estava tudo marcado → desmarca o ramo inteiro (pai com filhos arrasta os filhos);
 *  - senão (vazio ou parcial) → marca o ramo: cada nó ao nível máximo que permite, limitado pelo pai.
 * Marcar um filho acrescenta os antepassados que faltem.
 */
export function toggleNode(tree: readonly TreeNode[], key: string, grants: GrantMap): GrantMap {
  const idx = indexTree(tree);
  const info = idx.get(key);
  if (!info) return grants;
  const g = clone(grants);
  const branch = subtreeOf(info.node);
  if (checkState(info.node, grants) === "on") {
    for (const n of branch) delete g[n.key];
    return g;
  }
  if (!branch.some(selectable)) return grants;
  // Nível pretendido pelo nó clicado (mantém o já escolhido, senão o máximo).
  const own: TeamLevel = selectable(info.node) ? (g[key] ?? maxLevelOf(info.node)) : "edit";
  const first = branch.find(selectable)!;
  ensureAncestors(idx, first.key, first.key === key ? own : maxLevelOf(first), first.action, g);
  const walk = (n: TreeNode, ceiling: TeamLevel) => {
    let here = ceiling;
    if (selectable(n)) {
      const wanted: TeamLevel = n.key === key ? own : (g[n.key] ?? maxLevelOf(n));
      const lvl = clampTo(n, wanted, ceiling);
      g[n.key] = lvl;
      here = n.action ? ceiling : lvl;
    }
    for (const c of n.children ?? []) walk(c, here);
  };
  walk(info.node, info.node.storable ? ceilingFor(idx, key, g) : "edit");
  return g;
}

/** Limita `wanted` ao que o nó permite e ao tecto do pai (acções: sempre o único nível que têm). */
function clampTo(n: TreeNode, wanted: TeamLevel, ceiling: TeamLevel): TeamLevel {
  let l: TeamLevel = n.levels.includes(wanted) ? wanted : maxLevelOf(n);
  if (l === "edit" && ceiling === "view" && !n.action) l = "view";
  if (l === "edit" && n.maxLevel === "view" && !n.action && n.levels.includes("view")) l = "view";
  return n.levels.includes(l) ? l : maxLevelOf(n);
}

function clampLevel(n: TreeNode, wanted: TeamLevel, idx: Map<string, FlatInfo>, g: GrantMap): TeamLevel {
  return clampTo(n, wanted, ceilingFor(idx, n.key, g));
}

/**
 * Muda o nível de um nó (`Ver` | `Editar`). Se o nó não estava marcado, marca-o (e os antepassados).
 * Baixar para `view` baixa também os descendentes não-acção (um filho nunca fica acima do pai).
 * Um nível que o nó não permite é ignorado.
 */
export function setNodeLevel(tree: readonly TreeNode[], key: string, level: TeamLevel, grants: GrantMap): GrantMap {
  const idx = indexTree(tree);
  const info = idx.get(key);
  if (!info || !selectable(info.node) || !info.node.levels.includes(level)) return grants;
  if (level === "edit" && giveLevelOf(info.node) !== "edit") return grants;
  const g = clone(grants);
  // Um filho não-acção não passa o nível do pai: se o pai só tem `view`, o filho fica em `view`.
  const lvl = clampLevel(info.node, level, idx, g);
  g[key] = lvl;
  ensureAncestors(idx, key, lvl, info.node.action, g);
  if (lvl === "view") {
    for (const d of subtreeOf(info.node).slice(1)) {
      if (g[d.key] === "edit" && !d.action) g[d.key] = "view";
    }
  }
  return g;
}

/** Acesso total: todos os nós seleccionáveis ao nível máximo — menos os `excludeFromFullAccess` (ex. `equipa`). */
export function fullAccess(tree: readonly TreeNode[]): GrantMap {
  const g: GrantMap = {};
  for (const top of tree) {
    for (const n of subtreeOf(top)) {
      if (selectable(n) && !n.excludeFromFullAccess && !isFeatureHiddenNode(n.key)) g[n.key] = giveLevelOf(n) ?? maxLevelOf(n);
    }
  }
  return g;
}

/** Folhas devolvidas pela API → mapa (ignora chaves desconhecidas, agrupadores e níveis não permitidos). */
export function grantsToMap(
  tree: readonly TreeNode[],
  list: ReadonlyArray<{ key?: string; level?: string }> | undefined | null,
): GrantMap {
  const idx = indexTree(tree);
  const g: GrantMap = {};
  for (const e of list ?? []) {
    const n = e.key ? idx.get(e.key)?.node : undefined;
    const level = e.level as TeamLevel | undefined;
    if (n && n.storable && level && n.levels.includes(level)) g[n.key] = level;
  }
  return g;
}

/**
 * Mapa → lista a enviar à API: só nós `storable` e disponíveis, pela ordem da árvore. Higieniza o que a API
 * recusaria: descarta órfãos (sem o pai guardável) e baixa para `view` um filho não-acção acima do pai.
 */
export function serializeGrants(tree: readonly TreeNode[], grants: GrantMap, scopes: ScopeMap = {}): GrantEntry[] {
  const idx = indexTree(tree);
  const out: GrantEntry[] = [];
  const kept: GrantMap = {};
  const walk = (nodes: readonly TreeNode[]) => {
    for (const n of nodes) {
      const lvl = grants[n.key];
      if (selectable(n) && lvl && n.levels.includes(lvl)) {
        const p = idx.get(n.key)!.storableParent;
        const parentLvl = p ? kept[p] : undefined;
        if (!p || parentLvl) {
          const final: TeamLevel = !n.action && lvl === "edit" && parentLvl === "view" ? "view" : lvl;
          kept[n.key] = final;
          // Âmbito: só «Só os meus» viaja (ausente = Todos); onde quem edita não pode dar «Todos» fica forçado.
          out.push(n.scoped && scopeOf(n, scopes, n.key) === "meus" ? { key: n.key, level: final, scope: "meus" } : { key: n.key, level: final });
        }
      }
      walk(n.children ?? []);
    }
  };
  walk(tree);
  return out;
}

/** Quantas folhas seleccionáveis existem (para "x de y"). */
export function selectableCount(tree: readonly TreeNode[]): number {
  let c = 0;
  for (const top of tree) for (const n of subtreeOf(top)) if (selectable(n)) c++;
  return c;
}

/** Pelo menos um nó seleccionável marcado? */
/**
 * Aviso da cascata (B41 fase 3): retirar permissões a um membro que criou outros tira-as também aos convidados dele.
 * `null` quando ninguém é afectado.
 */
export function cascadeWarning(affected: number | undefined | null): string | null {
  const n = affected ?? 0;
  if (n <= 0) return null;
  return n === 1
    ? "Também sai a 1 utilizador criado por este membro."
    : `Também sai a ${n} utilizadores criados por este membro.`;
}

export function hasAnyGrant(tree: readonly TreeNode[], grants: GrantMap): boolean {
  return serializeGrants(tree, grants).length > 0;
}

/* ───────────────────────── Âmbito da sessão (Profissionais) ───────────────────────── */

/** Âmbito efectivo de uma folha da SESSÃO: `meus` só se a API o deu; sem grant (ou dono) = todos. */
export function grantScope(grants: readonly GrantEntry[], leaf: string): TeamScope {
  return grants.find((g) => g.key === leaf)?.scope === "meus" ? "meus" : "todos";
}

/**
 * Âmbito de um selector que serve várias folhas: `meus` só quando TODAS as que a sessão tem são «Só os meus»
 * (se alguma é «Todos», o selector completo continua a fazer sentido — a API filtra na mesma).
 */
export function grantScopeAll(grants: readonly GrantEntry[], leaves: readonly string[]): TeamScope {
  const held = grants.filter((g) => leaves.includes(g.key));
  return held.length > 0 && held.every((g) => g.scope === "meus") ? "meus" : "todos";
}
