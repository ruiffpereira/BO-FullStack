# F03 · API — Leitura do editor + admin (activar e manifest)

**Repo:** API-FullStack (+ `spec.json` no Backoffice) · **Tamanho:** M · **Depende:** F02
**Agentes:** 1 Sonnet (construtor) · `seguranca-api` · **Skill:** `endpoint-api`
**Contrato:** §5.1, §5.4, §4, §6.1

## Objetivo
`GET /cms/site-builder` (estado completo para o editor) e as rotas do dono para ligar o construtor e carregar o manifest.

## Ficheiros
- Novos: `routes/backoffice/cms/siteBuilderRoutes.ts`, `controllers/backoffice/cms/siteBuilderController.ts`
  (`getSiteBuilder`), `controllers/backoffice/admin/siteBuilderAdminController.ts` (`getAdmin`, `setEnabled`, `putManifest`),
  `src/schemas/siteBuilder.ts` (zod das entradas), `tests/backoffice/siteBuilderEditor.test.ts`,
  `tests/backoffice/siteBuilderAdmin.test.ts`.
- Mexe: `routes/index.ts` (montar `/cms/site-builder` com `authenticateToken, billingGate,
  authorizePermissions(["VIEW_SITE_PAGES"])`), `routes/backoffice/admin/adminUserRoutes.ts` (rotas
  `/:userId/site-builder`, `/:userId/site-builder/manifest`), `FUNCIONALIDADES.md`, `REFERENCIA-MODULOS.md`.

## Brief para o agente construtor (copiar)
> Usa o fluxo da skill `endpoint-api`. Implementa o CONTRATO §5.1 e §5.4 (só `GET`, `PUT` e `PUT /manifest` do admin;
> a publicação é do F08). O `GET /cms/site-builder` devolve `{enabled:false}` se não houver linha ou estiver desligado;
> senão o estado inteiro do tenant autenticado (`req.user.userId`), com `catalog` de `src/pageBuilder/catalog.ts`,
> línguas de `User.languages`/`defaultLanguage`, e `publish` **sem** campos de token. O admin actua no `:userId` da URL
> (o dono cruza tenants por desenho), mas valida que o utilizador existe. `PUT /manifest`: `parseManifest` (F02) e,
> se já houver conteúdo, `manifestUsages` → `409 MANIFEST_IN_USE {usages}` quando o manifest novo tira algo em uso.
> `@swagger` em cada handler (ver um controller existente, ex. `controllers/backoffice/admin/siteDomainController.ts`).
> Testes de comportamento em `tests/backoffice/siteBuilder*.test.ts` com os helpers de `tests/helpers/auth.ts`
> (`createUserWithPermissions`, `createAdminUser`). Relatório ≤ 300 palavras.

## Brief para `seguranca-api` (depois do construtor)
> Rotas novas: `GET /api/cms/site-builder`; `GET|PUT /api/admin/users/:userId/site-builder`;
> `PUT /api/admin/users/:userId/site-builder/manifest`. Cobre: isolamento A/B (o GET nunca mostra dados do B);
> sem `VIEW_SITE_PAGES` → 403; tenant comum nas rotas de admin → 403; sessão de suporte (impersonation) nas rotas de
> admin → `IMPERSONATION_FORBIDDEN`; manifest gigante (> 1 MB → erro controlado, não 500), com chaves `$ref`,
> tipos desconhecidos, ids com caracteres estranhos; `GET` nunca contém `githubTokenEnc`/`token`. `@swagger` presente.

## Revisão do supervisor
- [ ] Montagem: `billingGate` no editor; admin sem `billingGate` e com `forbidDuringImpersonation` (já na montagem)
- [ ] Allowlist de campos na resposta (nada de `toJSON()` cru do modelo)
- [ ] `409 MANIFEST_IN_USE` testado com um estilo em uso
- [ ] `FUNCIONALIDADES.md` e `REFERENCIA-MODULOS.md` actualizados

## Gates
API: `pnpm run docker:test && pnpm test && pnpm run build`. Backoffice: `pnpm kubb:refresh && pnpm lint` (commitar `spec.json`).

## Fecho
Commits: API `feat(site-builder): leitura do editor e admin do construtor` → Backoffice `chore(kubb): spec com o
construtor de páginas` — **sem push** (PLANO §5). `TASKS.md`: F03 ✅.
