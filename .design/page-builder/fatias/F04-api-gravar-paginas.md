# F04 · API — Gravar (1/2): páginas, árvore, endereços, redireccionamentos, itens

**Repo:** API-FullStack (+ `spec.json` no Backoffice) · **Tamanho:** L · **Depende:** F03
**Agentes:** 1 Sonnet · `seguranca-api` · **Skill:** `endpoint-api`
**Contrato:** §5.2, §6.1–§6.5, §6.7 (só páginas), §6.8, §2 (SitePages, SitePageItems, SiteRedirects)

## Objetivo
`POST /cms/site-builder/save` funcional para **páginas e itens** (blocos, pastas e partes chegam no F05, mas o
formato do corpo já é o final: as chaves `blocks`, `folders`, `parts` são aceites e, nesta fatia, recusadas com
`422 NOT_YET` se vierem preenchidas).

## Passos de implementação (ordem dentro da transacção)
1. Validar o corpo com zod (forma) — `src/schemas/siteBuilder.ts`.
2. `sequelize.transaction` + `SiteBuilders.findOne({where:{userId}, lock: t.LOCK.UPDATE})`; desligado → `403`.
3. `baseRevision !== revision` → `409 REVISION_CONFLICT {revision}`.
4. Carregar o estado actual do tenant (páginas, itens, blocos — os blocos já existem para validar referências).
5. Para cada `upsert`: se o id existe e é de **outro** tenant → `404`; senão aplicar no estado em memória.
   Para cada `delete`: só ids do tenant.
6. Validar o **estado final** com os módulos do F02: árvore (ciclos, home, profundidade), slugs/paths por língua,
   traduções do `title`/`seo` (§6.4), referências que apontam para páginas apagadas (`PAGE_IN_USE`), itens
   (`blockId` do tenant, `specialType` no manifest — os especiais validam-se a sério no F05).
7. Recalcular `path` de todas as páginas tocadas e descendentes; criar `SiteRedirects` para paths que mudaram
   (antigo → página), por língua; apagar redirects cujo `fromPath` passou a ser path vivo.
8. Escrever (bulk), `revision++`, `publishRequestedAt = now` se `publishMode='github'`; commit; responder
   `{revision, redirectsAdded}`.

## Brief para o agente construtor (copiar)
> Usa a skill `endpoint-api`. Implementa o `POST /api/cms/site-builder/save` da fatia F04
> (`Backoffice/.design/page-builder/fatias/F04-api-gravar-paginas.md`, secção "Passos") com o CONTRATO §5.2 e §6.
> Reaproveita os validadores de `src/pageBuilder/` (não reimplementes regras). Toda a escrita numa transacção com lock
> na linha `SiteBuilders`. Ids do cliente nunca podem tocar em linhas de outro tenant. Respostas: 200/409/422 com
> `issues` no formato do contrato. `@swagger` completo. Testes em `tests/backoffice/siteBuilderSavePages.test.ts`:
> criar árvore de 3 níveis; mover página (paths e redirects das descendentes); slug por língua repetido → 422;
> ciclo → 422; apagar página com filhas → 409; apagar página referenciada por um bloco (criar o bloco directamente no
> teste) → 409 com refs; tradução em falta no título → 422 com locale; revisão desactualizada → 409; dois saves
> concorrentes → um ganha, outro 409. Relatório ≤ 300 palavras.

## Brief para `seguranca-api`
> `POST /api/cms/site-builder/save` (páginas e itens). Cobre: upsert com id de página do tenant B → 404 e B intacto;
> `items` para uma página do B → 404; `blockId` do B num item → 422/404; corpo de 1 MB+; 500 páginas (limite);
> slugs com `../`, `%2F`, unicode, maiúsculas; `isHome` em duas páginas; sem permissão → 403; billing read-only →
> comportamento do `billingGate`.

## Revisão do supervisor
- [ ] Transacção cobre **todas** as escritas (incluindo redirects) — nada fora dela
- [ ] O lock é na linha do tenant, não na tabela
- [ ] Redirects por língua (o `fromPath` leva o prefixo `/en/…`)
- [ ] Nenhuma regra duplicada fora de `src/pageBuilder/`

## Gates · Fecho
API gates + `pnpm kubb:refresh` no Backoffice. Commits API → Backoffice (`spec.json`) — **sem push** (PLANO §5). `TASKS.md`: F04 ✅.

## Se a sessão estiver a ficar sem contexto
Corte seguro: passos 1–6 com testes (sem redirects) num commit verde **sem push**; redirects (passo 7) na sessão
seguinte, e só então ✅. (Sem redirects, mudar um endereço partiria links — não pode ir para produção a meio.)
