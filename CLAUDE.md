# CLAUDE.md — Backoffice

Vite + React + TypeScript + Tailwind + React Query (hooks gerados por Kubb).
Um único deploy serve **todos** os tenants da plataforma. **PWA** "RufVision BO" (`public/manifest.json`,
`index.html`, `public/sw.js`, ícones em `public/icons/` — ao trocar os ícones, incrementar o `?v=` nos URLs).

> **Coordenação da plataforma:** [`../CLAUDE.md`](../CLAUDE.md) (roteiro + **Regra cross-repo**) ·
> [`../TASKS.md`](../TASKS.md) (o que falta) · [`../DECISOES.md`](../DECISOES.md) (porquê) ·
> [4.2 armadilhas](<../docs/4 - Como trabalhar/4.2 - armadilhas.md>) (erros já pagos).
>
> **Detalhe por página/componente:** [REFERENCIA-PAGINAS.md](REFERENCIA-PAGINAS.md) — ler quando se mexe na página em causa;
> a secção final («Invariantes e detalhe movidos do CLAUDE.md») tem o texto completo de cada regra resumida abaixo.
> **Planos dos itens em curso:** `docs/6 - Planos/` na raiz.

Este ficheiro tem **invariantes**. Estado e trabalho aberto vivem no `TASKS.md` da raiz.

---

## Comandos

```bash
pnpm dev          # Kubb + Vite (porta 5173)
pnpm build        # Kubb + build de produção
pnpm kubb         # regenera hooks/tipos a partir do spec.json COMMITADO (offline)
pnpm kubb:refresh # busca o spec fresco da API, reescreve spec.json e regenera
pnpm lint         # eslint src (flat config) + tsc --noEmit (strictNullChecks, noUnusedLocals/Parameters)
pnpm test:unit    # componentes (Vitest + RTL + jsdom) — sem servidor
pnpm test:e2e     # Playwright — arranca tudo sozinho
```

A API tem de estar no URL de `VITE_API_BASE_URL` (dev: `http://localhost:3001/api`).

---

## Envs (obrigatórias — SEM defaults)

> **REGRA — nenhuma env tem default silencioso.** Se faltar, o build recusa. **Nunca** `import.meta.env.X` solto com `?? "..."`.
> **DUAS camadas que listam o MESMO conjunto:** `REQUIRED_ENVS` em **`vite.config.ts`** **+** [`src/lib/env.ts`](src/lib/env.ts)
> (único ponto de leitura em runtime; exporta `API_BASE`). Uma env nova entra nas **duas** (e o `kubb.config.ts` exige `VITE_API_BASE_URL`).

- Valores: dev → `.env.development` (commitado) · e2e → `.env.test` (gitignored, o CI gera) · **prod → build-time variables no Coolify** (as `VITE_*` ficam embutidas no bundle no build; mudá-las em runtime não faz nada).
- ⚠ **NUNCA commitar um `.env`**: o Vite carrega-o em todos os modos, incluindo produção — satisfaz o fail-fast **com o valor errado**.

---

## Testes

- **Componentes** (`tests/unit/`, Vitest + RTL + jsdom) — sem servidor nem API; hooks que tocam a API mockados (`vi.mock`).
- **E2E** (`tests/e2e/`, Playwright/Chromium, serial; page objects em `tests/e2e/pages/`) — arranca sozinho uma API de teste na `:3002` (BD **`api_e2e`**, `mysql-test:3307`) e o Vite na `:5273`; **nunca toca em dev**. O `globalSetup` corre `pnpm seed:e2e` (`API-FullStack/scripts/seedE2e.ts`): **o seed é a verdade** (tenants, utilizadores, `E2E_*`) — não se copiam listas para aqui.
- **Auth nos specs:** gerais usam `{ test, expect }` de `fixtures/auth.ts`; RBAC/isolamento usam `loginAs(context, "<user>@e2e")` + `storageState` vazio. Os modais expõem `role="dialog"` e o `Input` é `type="text"` por defeito — os page objects dependem disso. Detalhe: REFERENCIA-PAGINAS.md.

---

## Estrutura

```
src/ App.tsx (rotas + redirects legacy) · pages/ (uma por rota; grandes em pages/<área>/) · components/ ·
ui/ui.jsx (primitivas) · hooks/ (manuais) · gen/backoffice/ (GERADO pelo Kubb — nunca editar) ·
context/ (AuthContext; helpers em context/auth/) · lib/ (env, navigation, …) · types/ utils/
```

- **Nenhum ficheiro de página ou componente passa de ~600 linhas**: o ficheiro da rota fica fino e cada vista vive em `pages/<área>/`; lógica pura sai para `*.ts` com teste unitário; estado/efeitos para um hook da pasta. Ao partir um ficheiro, **manter o reexport** do que outros importam. Lista de excepções: REFERENCIA-PAGINAS.md.
- **Ficha de cliente: UMA só** — `components/customers/CustomerProfileModal` (as permissões EQ-06 vivem em `customerAccess()`). Não duplicar a ficha noutra página.

---

## Páginas, navegação e permissões

Tabela de páginas/rotas/permissões: [REFERENCIA-PAGINAS.md](REFERENCIA-PAGINAS.md). Invariantes:

- **Core** (sem permissão): Dashboard · Clientes · Mensagens · Financeiro · Conteúdos · Estatísticas · Faturação; **módulos** por permissão (`MODULE_PERM_TO_PATH`): Agenda · Loja · Ginásio · Páginas (`VIEW_SITE_PAGES`); **Admin** à parte (`VIEW_ADMIN`). Um root sem nenhum subitem permitido sai do `accessiblePaths`.
- **`SUBMENU` em `src/lib/navigation.ts` é a fonte única** dos submenus (`perm` string|array=OR). O guard de rotas é por prefixo: um subitem sem permissão redirecciona para o 1.º subitem permitido do mesmo pai, nunca para o dashboard. Rota nova entra em `LEAF_FOR_PATH` ou `LEAF_EXEMPT_PATHS` (`routesLeaves.test.ts`).
- Item **"Correio"** (nunca "Email": colide com Conteúdos → Emails).
- ⚠ **Labels de subitens nunca duplicam nomes acessíveis da sidebar** (parte os testes RBAC/e2e): "Lista" (não "Clientes") em `/clientes`, "Progresso de clientes" em `/ginasio/clientes`, "Produtos"/"Serviços"/"Ginásio (nomes)" em `/conteudos`. Os subitens só existem no DOM com o grupo expandido — nunca escondidos por CSS.
- **Funcionalidades escondidas** (`src/lib/features.ts`: `signup`, `googleCalendar`, `campaigns`): o código fica, voltar = `true`; esconder o ecrã não fecha a rota na API.

### Equipa do tenant (B41) — o membro não é o dono

- `useAuth()` expõe `member` (`null` = dono), `isMember`, `can(chave, nível)`. Os níveis vêm da API (`GET /user-permissions/access`) — **nunca** se calculam nem se deduzem no frontend. Em sessão de suporte o admin é o **dono**.
- **Um membro nunca pede o que a API recusa** (`TEAM_OWNER_ONLY`: `/billing`, `/users/me*`): o Shell esconde a Faturação e o guard não monta a página de uma rota fora do permitido. Um hook novo que corra em todas as páginas respeita `isMember`.
- Permissões são uma **árvore de folhas** (`lib/teamTree.ts`); um subitem novo **tem** de declarar `leaf` ou `ownerOnly` (default-deny, `teamAccess.test.ts`). **O dinheiro some, não vira "0 €"**: a UI trata `undefined` e esconde a secção.
- **"Só ver" é o `useWriteGuard`**, não um `disabled` à mão; **fail-closed** (rota sem folha fica só-leitura). CTAs de escrita → `GuardButton`/`GuardIconButton`; `<button>` cru de escrita usa `useWriteGuard()`. O `/perfil` do membro é outra página (`PerfilMembro`) e o tema dele não vai ao servidor. Detalhe (2c, SSE, sino): REFERENCIA-PAGINAS.md.

---

## Dinheiro no ecrã — só se mostra

O Backoffice **nunca calcula** dívida, totais faturados, contagens abertas nem stock baixo: lê `debt`/`priorDebt`, `stats` de `/orders` e `/products`. Euros só com `fmtEur` (`lib/money.ts`, pt-PT; `moneyFormat.test.ts` falha com `toFixed(2)} €`). Toda a mutation que mexe em dinheiro chama `invalidateMoney(qc)`. Listas que podem crescer paginam no servidor (`serverPagination` + `<Pagination>`). Um `<select>` que grava ao mudar usa `GuardSelect`.

## Primitivas de UI — não reimplementar

`src/ui/ui.jsx`: `Card`, `Button`, `IconButton`, `Badge`, `Input`, `Select`, `Toggle`, `Avatar`, `Modal`, `PageHeader`, `EmptyState`, `ImgPlaceholder`, `Tabs`, `SectionTitle`.

- **Toda a troca de secção usa `<Tabs>`** (inclui as abas de uma modal); período em segmentos = `components/PeriodSelector`; folha em baixo no telemóvel = a própria `Modal`. Não reimplementar tabs, eyebrows nem sheets à mão.
- `Modal` tem pilha (Esc fecha só o do topo, focus-trap).
- **`GuardButton`/`GuardIconButton`** = drop-in do `Button` para **escritas** (billing read-only ou membro só-ver) — nunca para navegação, leitura, logout, portal Stripe ou chat de suporte.
- **Confirmações — um só sistema:** `ConfirmDialog` / `confirmDialog({...})` (`components/confirm.tsx`); a **folha do confirmar é a do botão que o abre** (se o gatilho leva `leaf=…`, passa o mesmo ao `confirmDialog`). Não criar um terceiro desenho.

---

## Geração de código (Kubb)

`spec.json` → `src/gen/backoffice/{hooks,types}/`. **Nunca editar `src/gen/` à mão.** O `kubb.config.ts` gera **sempre** do `spec.json` **committado** (offline, determinístico). Quando a API muda: `pnpm kubb:refresh` e **committar o `spec.json`**.

- **Tipos: sempre os gerados** — alias de `src/gen/backoffice/types/**`, nunca `interface` à mão que duplica um schema. Um `as any` por «falta de tipo» é defeito do `@swagger` da API — corrige-se lá, não aqui.
- Aliases deprecated da API têm `operationId` próprio (o BO não os usa). `kubb.config.ts` leva `@ts-nocheck`.
- `X-CI-Bypass` com `CF_BYPASS_TOKEN` (Bot Fight Mode): ⚠ **NUNCA prefixar com `VITE_`** (iria para o bundle). Detalhe: REFERENCIA-PAGINAS.md.

---

## Autenticação (`AuthContext.tsx`)

- `accessToken` **em memória**; refresh `POST /users/refresh` (cookie httpOnly) + CSRF `x-csrf-token`. O interceptor do axios injecta o `Authorization`: **nunca se passa `headers`/`Authorization` à mão** (`fetch`/SSE directos são a única excepção). Depois do login/refresh vai buscar `GET /user-permissions/access` antes de a sessão ficar autenticada.
- **Sessão de suporte** (admin na conta de um tenant, token 60 min, **sem refresh token**; o cookie é o do ADMIN): **nunca `/users/refresh`** (um 401 faz `endImpersonation("ended")`); **`logout()` nunca chama `/users/logout` nem `/push/unsubscribe`**; **nada no `localStorage`** (estado em `sessionStorage`, `backoffice.supportSession`); sem `useSSE`/push/sino; `canImpersonate` vem do servidor. Provado em `AuthContextSupport.test.tsx`. Detalhe: REFERENCIA-PAGINAS.md.

---

## Layout — alturas SEMPRE por flex (regra obrigatória)

**O `Shell` é o único dono da altura do viewport.** **Proibido** `calc(100vh - Xpx)`, `h-screen`, `100dvh` e offsets fixos que adivinhem a altura do chrome (o `BillingBanner` aparece e desaparece). Cadeia flex: Shell = coluna `h-dvh` → página `flex-1 min-h-0` → tabelas/listas com scroll **interno** (`overflow-auto`). Páginas que enchem a altura pedem-no ao Shell (`fillPage`/`fillAgenda`/`fillConteudos`/`fullBleed`). Acções só-hover usam `REVEAL_ON_HOVER`, nunca `opacity-0 group-hover` à mão.

**Lint:** `typescript-eslint` + `react-hooks` (`rules-of-hooks` = erro). `no-explicit-any` = aviso (a baixar; um `any` novo precisa de motivo). Chaves de React Query à mão em `src/lib/queryKeys.ts`.

---

## Segurança e boas práticas

- Nunca expor `userId` nem dados de outros tenants nas queries; nunca passar `headers`/`Authorization` à mão.
- Uploads via `/api/uploads` — **nunca base64 em JSON**. **Upload diferido:** os ficheiros ficam locais (preview `blob:`) e só sobem em **Guardar**, nunca ao escolher (Ginásio, Loja, Conteúdos/CMS).
