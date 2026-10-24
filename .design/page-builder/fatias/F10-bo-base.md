# F10 · Backoffice — Base: rota, menu, dados, estado de trabalho e gravar

**Repo:** Backoffice · **Tamanho:** M · **Depende:** F09 · **Agentes:** 1 Sonnet · `e2e-backoffice` (só RBAC do menu)
**Contrato:** §1, §5.1, §5.2, §6.4 · **Protótipo:** `prototipo.html` (estrutura geral, botões do topo)
**Ler antes:** `docs/4 - Como trabalhar/4.2 - armadilhas.md` (alturas, labels de navegação) · `Backoffice/CLAUDE.md`

## Objetivo
O esqueleto da página **Páginas** e o cérebro dela: estado de trabalho com desfazer/refazer e uma gravação que manda
tudo de uma vez. As fatias seguintes só desenham por cima.

## Ficheiros (novos em `src/pages/paginas/`)
| Ficheiro | O que tem |
|---|---|
| `Paginas.tsx` | Página com as duas colunas (lista | centro), responsiva (§7 do PLANO), estado vazio quando `enabled:false` |
| `state/store.ts` | `useReducer` + contexto: `server` (último estado da API), `work` (cópia de trabalho), `history` (pilha de fotografias, máx. 200), selecção (`pageId`, `libId`, `sel`), `status` |
| `state/history.ts` | `record(key?)` com junção de teclas no mesmo campo (≤ 1,5 s), `undo`, `redo`, ponto "guardado" |
| `state/changeset.ts` | diferença `server` → `work` no formato do §5.2 (upsert/delete por entidade, `items` completos das páginas tocadas) |
| `state/missing.ts` | traduções em falta (mesma regra do §6.4, só para a UX — a API é a autoridade) + `firstMissing()` |
| `state/ids.ts` | `crypto.randomUUID()` para entidades, nanoid(10) para componentes e itens de lista |
| `hooks/useSiteBuilder.ts` (em `src/hooks/`) | envolve os hooks gerados pelo Kubb (`GET`, `save`, `publish`) |

Mexe: `src/App.tsx` (rota `/paginas`), `src/components/Shell.tsx` (item "Páginas" em `MENU_ORDER`/`ROUTE_META`,
visível com `VIEW_SITE_PAGES`), barra de topo da página com **Desfazer · Refazer · estado · "N por traduzir · Ver onde" · Guardar**.

## Brief para o agente (copiar)
> Implementa a fatia F10 (`Backoffice/.design/page-builder/fatias/F10-bo-base.md`). Usa só primitivas de
> `src/ui/ui.jsx` e o `GuardButton` no Guardar. Alturas por flex (o `Shell` é dono da altura): nada de `calc(100vh…)`
> nem `h-screen`. O estado vive num reducer com contexto (sem libs novas). Desfazer/refazer por fotografias JSON do
> `work`, com junção de escrita no mesmo campo, atalhos Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y **fora** de caixas de texto.
> Guardar: bloqueado se `missing.ts` encontrar falhas; envia o `changeset` com `baseRevision`; `409` → aviso "Esta
> conta foi alterada noutro sítio" com "Recarregar" (sem perder o trabalho até a cliente escolher); `422` → guarda os
> `issues` no estado (as fatias seguintes mostram-nos nos sítios certos). Menu "Páginas" só com `VIEW_SITE_PAGES`.
> Nesta fatia a lista e o centro podem ser marcadores simples — o desenho vem no F11–F15.
> Testes unitários (Vitest) para `history`, `changeset` (criar/editar/apagar página, bloco, pasta, mexer itens),
> `missing` e `firstMissing`. `pnpm lint` e `pnpm test:unit` verdes. Relatório ≤ 300 palavras.

## Brief para `e2e-backoffice`
> Só RBAC: utilizador com `VIEW_SITE_PAGES` vê "Páginas" e abre `/paginas`; sem a permissão não vê o item e a rota
> redirecciona; tenant com construtor desligado vê o estado vazio. Nas três larguras (1440, 834, 390).

## Revisão do supervisor
- [ ] Nenhuma regra de negócio no componente — estão em `state/`
- [ ] O changeset nunca manda o estado inteiro sem necessidade
- [ ] O label "Páginas" não colide com nenhum item da sidebar (ARMADILHAS)

## Gates · Fecho
`pnpm lint && pnpm test:unit && pnpm exec playwright test <spec do RBAC>`. Commit — **sem push** (PLANO §5). `TASKS.md`: F10 ✅.
