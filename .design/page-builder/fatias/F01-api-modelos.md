# F01 · API — Modelos, migração, purga e permissão

**Repo:** API-FullStack · **Tamanho:** M · **Depende:** F00 · **Agentes:** 1 Sonnet (construtor)
**Contrato:** §1, §2

## Objetivo
Criar as 6 tabelas do construtor, a permissão `VIEW_SITE_PAGES` e pôr tudo na purga do tenant. **Sem endpoints.**

## Dentro / fora
- Dentro: modelos Sequelize, associações, migração única com `up`/`down`, `REQUIRED_COMPONENTS`, purga, testes.
- Fora: validação de conteúdo (F02), rotas (F03+).

## Ficheiros
- Novos: `models/siteBuilder.ts`, `models/sitePage.ts`, `models/siteBlock.ts`, `models/siteBlockFolder.ts`,
  `models/sitePageItem.ts`, `models/siteRedirect.ts`; `migrations/<YYYYMMDDHHMMSS>-site-builder.js`;
  `tests/backoffice/siteBuilderModels.test.ts`.
- Mexe: `models/index.ts` (init + associações + `REQUIRED_COMPONENTS` += `VIEW_SITE_PAGES`),
  `tests/helpers/globalSetup.ts` e `scripts/seedE2e.ts` (replicar o componente — ver `models/index.ts:160-177`),
  `controllers/backoffice/admin/userController.ts` (`hardDeleteTenantData`, zona `:827-857`),
  `tests/backoffice/tenantHardDelete.test.ts` (lista `tableChecks` `:431-486`).

## Brief para o agente (copiar tal e qual)
> És um construtor na API-FullStack (Express + TypeScript + Sequelize, MySQL; prod 8.4, testes 5.7).
> Lê `Backoffice/.design/page-builder/CONTRATO.md` §1 e §2 e implementa **exactamente** essas tabelas.
> Segue o estilo de `models/contentEntry.ts` (classe + `init*`), regista em `models/index.ts` e cria as associações
> (SitePage.parentId → SitePage; SitePageItem → SitePage/SiteBlock; SiteBlock → SiteBlockFolder; SiteRedirect → SitePage;
> todas com `userId` → Users). Colunas JSON **sem defaultValue** no modelo nem na migração.
> Migração única `migrations/<timestamp>-site-builder.js` (CommonJS, `up`/`down`, ver o formato das recentes em
> `migrations/`), com os índices e UNIQUE do contrato. Junta `VIEW_SITE_PAGES` a `REQUIRED_COMPONENTS` e replica-o
> em `tests/helpers/globalSetup.ts` e `scripts/seedE2e.ts`. Na purga (`hardDeleteTenantData`) apaga as tabelas novas
> **antes** das que elas referenciam (itens → redirects → páginas → blocos → pastas → SiteBuilders) e junta-as à
> lista de `tests/backoffice/tenantHardDelete.test.ts`.
> Testes em `tests/backoffice/siteBuilderModels.test.ts`: cria registos de 2 tenants, confirma os UNIQUE
> (`(userId,path)`, `(userId,anchor)`, `(userId,fromPath)`), e que a purga do tenant A apaga tudo dele e nada do B.
> Não cries rotas nem controllers. Corre `pnpm test` (com `pnpm run docker:test`) e `pnpm run build`.
> Relatório final ≤ 300 palavras: ficheiros, decisões que tomaste, resultado dos testes.

## Revisão do supervisor
- [ ] Nenhum JSON com default; `path` STRING(255); ENUMs como no contrato
- [ ] `userId` em todas as tabelas e com índice
- [ ] Ordem de apagar na purga respeita as FKs (sem 500 por FK)
- [ ] `down` da migração apaga pela ordem inversa
- [ ] **Provar `up` e `down`** numa BD descartável (docker de teste): `npx sequelize-cli db:migrate` e `db:migrate:undo`
      com a config de teste — a migração corre sozinha no arranque em produção

## Gates
`pnpm run docker:test && pnpm test && pnpm run build && pnpm run docker:test:down`

## Fecho
Commit `feat(site-builder): tabelas, permissão VIEW_SITE_PAGES e purga` — **sem push** (PLANO §5). Sem mudança de contrato da API
(não há rotas), por isso sem Kubb. `TASKS.md` desta pasta: F01 ✅.

## Se a sessão estiver a ficar sem contexto
Ponto de corte seguro: depois dos modelos + migração com testes verdes (commit), deixar a purga para a sessão seguinte
— a fatia **não** fica ✅ sem a purga (um tenant com dados do construtor ficaria inapagável).
