# CLAUDE.md — Backoffice

Vite + React + TypeScript + Tailwind + React Query (hooks gerados por Kubb).
Um único deploy serve **todos** os tenants da plataforma.
**PWA:** instala-se como "RufVision BO" (`public/manifest.json` + `index.html` + fallback de push em
`public/sw.js`), ícones em `public/icons/` — ao trocar os ícones, incrementar o `?v=` nos URLs para
forçar o refresh nos dispositivos já instalados.

> **Coordenação da plataforma:** [`../CLAUDE.md`](../CLAUDE.md) (roteiro + **Regra cross-repo**) ·
> [`../TASKS.md`](../TASKS.md) (o que falta) · [`../DECISOES.md`](../DECISOES.md) (porquê) ·
> [`../docs/ARMADILHAS.md`](../docs/ARMADILHAS.md) (erros já pagos).
>
> **Detalhe por página/componente:** [REFERENCIA-PAGINAS.md](REFERENCIA-PAGINAS.md) — ler quando se
> mexe na página em causa. **Briefs de todos os épicos da plataforma:** `.design/<épico>/`.

Este ficheiro tem **invariantes**. Estado e trabalho aberto vivem no `TASKS.md` da raiz.

---

## Comandos

```bash
pnpm dev          # Kubb + Vite (porta 5173)
pnpm build        # Kubb + build de produção
pnpm kubb         # regenera hooks/tipos a partir do spec.json COMMITADO (offline)
pnpm kubb:refresh # busca o spec fresco da API, reescreve spec.json e regenera
pnpm lint         # tsc --noEmit
pnpm test:unit    # componentes (Vitest + RTL + jsdom) — sem servidor
pnpm test:e2e     # Playwright — arranca tudo sozinho
```

A API tem de estar no URL de `VITE_API_BASE_URL` (dev: `http://localhost:3001/api`).

---

## Envs (obrigatórias — SEM defaults)

> **REGRA — nenhuma env tem default silencioso.** Se faltar, é erro: o build recusa. Toda env
> obrigatória tem **fail-fast** numa **superfície de validação única**. Ao adicionar ou mudar uma
> env, ligá-la a essa validação — **nunca** `import.meta.env.X` solto com `?? "..."` / `|| "..."`.
>
> **Superfície (este repo) — DUAS camadas que têm de listar o MESMO conjunto:** `REQUIRED_ENVS` em
> **`vite.config.ts`** (falha o build/dev antes de qualquer código correr) **+** [`src/lib/env.ts`](src/lib/env.ts)
> (único ponto de leitura em runtime; `required()` como backstop; exporta `API_BASE`/`SITE_ROOT_URL`).
> Uma env nova entra nas **duas**, nunca só numa.

| Env | Para quê | Dev | Prod |
|---|---|---|---|
| `VITE_API_BASE_URL` | Base da API | `http://localhost:3001/api` | URL real |
| `VITE_SITE_ROOT_URL` | Base pública dos sites dos tenants (`{sub}.{host}`) | `http://localhost:3000` | ex. `https://rufvision.com` |

- **Onde vivem os valores:** dev → `.env.development` (commitado) · e2e → `.env.test` (gitignored, o
  CI gera) · **prod → build-time variables no Coolify** (as `VITE_*` ficam embutidas no bundle **no
  momento do build** — mudá-las em runtime não faz nada).
- **Terceira camada:** `kubb.config.ts` exige `VITE_API_BASE_URL` (env real > `.env` > `.env.development`).
  O vitest injecta os valores via `test.env`.
- ⚠ **NUNCA commitar um `.env`.** O Vite carrega-o em **todos** os modos, incluindo o build de
  produção — um `.env` commitado com valores de dev satisfaz o fail-fast **com o valor errado**.
  Foi exactamente o bug do `teste1.localhost:3000` em produção (2026-07-02).

---

## Testes

Duas camadas, ambas em `tests/`:

- **Componentes** (`tests/unit/`, Vitest + RTL + jsdom) — isolados, sem servidor nem API. Setup em
  `tests/unit/setup.ts`. Os hooks que tocam a API são mockados (`vi.mock`).
- **End-to-end** (`tests/e2e/`, Playwright/Chromium) — `pnpm test:e2e`, **não precisa de nada ligado
  à mão** (~87 specs, serial). Page objects em `tests/e2e/pages/`.

**Infra isolada — NUNCA toca em dev.** O `playwright.config.ts` arranca dois servidores próprios e
semeia uma BD dedicada:

- **API de teste** na `:3002` (`ENVIRONMENT=TEST`, `API-FullStack/.env.e2e`) contra a BD **`api_e2e`**
  no `mysql-test:3307` — separada do `api_test` dos testes de integração e da de dev.
- **Vite** na `:5273` com `--mode test` → lê `.env.test`.
- **`globalSetup`** corre `pnpm seed:e2e` (`API-FullStack/scripts/seedE2e.ts`): recria o schema
  (`sync force`) e cria **4 tenants** — `admin@e2e` (Admin), `limited@e2e` (só `VIEW_PRODUCTS`),
  `tenantA@e2e`/`tenantB@e2e` (Admin, dados distintos) — mais dados de negócio.
  Password: `E2ePass123!`.

**Autenticação nos specs:** os gerais importam `{ test, expect }` de `tests/e2e/fixtures/auth.ts`
(login como `admin@e2e`). Os de **RBAC/isolamento** usam `loginAs(context, "<user>@e2e")` de
`fixtures/login.ts` + `test.use({ storageState: vazio })`. Os de `auth`/`security` correm **sem**
auth de propósito; o `errors` intercepta a API.

> Notas: toda a escrita vai para `api_e2e` (recriada a cada corrida) · os modais expõem
> `role="dialog"` e o `Input` partilhado é `type="text"` por defeito — os page objects dependem
> disso · o `authRateLimit` da API isenta o loopback fora de produção · marcações semeadas precisam
> de um `serviceId` válido.

---

## Estrutura

```
src/
  App.tsx         — rotas + redirects legacy (LegacyTabEntry, AgendaEntry, AdminEntry)
  pages/          — uma por rota (+ clientes/ e financeiro/)
  components/     — Shell, BillingBanner, GuardButton, FirstValueChecklist, chat/…
  ui/ui.jsx       — primitivas partilhadas
  hooks/          — hooks manuais (não gerados)
  gen/backoffice/ — GERADO pelo Kubb — nunca editar à mão
  context/        — AuthContext (JWT + refresh automático)
  lib/            — env, navigation (SUBMENU), blockCatalog, siteCms, apptStatus, billingStatus…
  templates/ types/ utils/
```

---

## Páginas e permissões

Detalhe de cada página em [REFERENCIA-PAGINAS.md](REFERENCIA-PAGINAS.md).

| Página | Rotas | Permissão |
|---|---|---|
| `Dashboard.tsx` | `/` | qualquer |
| `Clientes.tsx` | `/clientes` · `/clientes/leads` | **core** |
| `Mensagens.tsx` | `/mensagens` | **core** (chat de suporte) |
| `Conteudos.tsx` | `/conteudos` · `/produtos` · `/servicos` · `/ginasio` · `/linguas` · `/emails` · `/notificacoes` | **core**, com gating **por subitem** |
| `Website.tsx` | `/website` · `/website/paginas` · `/website/marca` | **core** + `canEditStructure` dentro da página |
| `Faturacao.tsx` | `/faturacao` | **core** |
| `FinanceiroPage.tsx` | `/financeiro` · `/agenda` · `/loja` · `/ginasio` · `/despesas` | **core**, subitens gated |
| `Perfil.tsx` | `/perfil` | **core, fora da sidebar** (menu do avatar) |
| `Agenda.tsx` | `/agenda` · `/marcacoes` · `/servicos` · `/config` | `VIEW_SCHEDULE` |
| `Loja.tsx` | `/loja` · `/encomendas` · `/categorias` | `VIEW_PRODUCTS` |
| `Ginasio.tsx` | `/ginasio` · `/treinos` · `/planos` · `/clientes` | `VIEW_GYM` |
| `Admin.tsx` | `/admin` + 7 subrotas | `VIEW_ADMIN` |
| `Estatisticas.tsx` | `/estatisticas` | `VIEW_ADMIN` — **gate temporário de UI** (2026-07-08); a API continua tenant-open. Reverter = devolvê-la a `CORE_PATHS` |
| `Login` · `SetupPassword` · `Signup` | `/login` · `/setup-password` · `/signup` | **público** (standalone, sem Shell) |

### Navegação (`Shell.tsx` + `src/lib/navigation.ts`)

- **Core (todos, sem permissão):** Dashboard · Clientes · Mensagens · Financeiro · Conteúdos ·
  Website · Faturação. No backend, `/customers`, `/expenses`, `/cms`, `/dashboard`, `/analytics`,
  `/chat/support` e `/website` só exigem `authenticateToken` (dados scoped por `userId`).
- **Módulos (por permissão, `MODULE_PERM_TO_PATH`):** Agenda · Loja · Ginásio. **Admin** à parte, e
  **Estatísticas** temporariamente também (`ADMIN_GATED_PATHS`).
- **Ordem da sidebar** (`MENU_ORDER`) é um array fixo; o que não estiver listado vai para o fim.
- **Submenus:** `SUBMENU: Record<path, SubmenuItem[]>` em `src/lib/navigation.ts` é a **fonte única**
  (`perm` aceita `string | string[]`; array = OR). `allowedSubitems` filtra, `findRoot` resolve a que
  grupo um pathname pertence, `resolveLegacyTabTarget` traduz deep-links antigos `?tab=`/`?vista=`.
  Grupo que sobre com **1 só** subitem permitido é mostrado como link simples, não como expansível.
- **Guard de rotas por prefixo:** um pathname sob um root acessível é válido. Um subitem sem
  permissão redirecciona para o 1.º subitem permitido do **mesmo pai**, nunca para o dashboard.
  `/despesas` e `/perfil` entram em `guardRoots` como roots extra (senão o guard expulsa-os).

> ⚠ **Regra crítica — labels de subitens nunca duplicam nomes acessíveis da sidebar.** Quando um
> grupo expande, subitens e itens de módulo coexistem no mesmo `<nav>`: um subitem homónimo de um
> item sempre visível duplica o nome em qualquer `getByRole("button", { name })` e **parte os testes
> RBAC/e2e**. Por isso "Lista" (não "Clientes") em `/clientes`; "Progresso de clientes" em
> `/ginasio/clientes`; "Site público"/"Produtos"/"Serviços"/"Ginásio (nomes)" nos subitens de
> `/conteudos`. Os subitens só existem no DOM quando o grupo está expandido — nunca escondidos por CSS.

---

## Primitivas de UI — não reimplementar

`src/ui/ui.jsx`: `Card`, `Button`, `IconButton`, `Badge`, `Input`, `Select`, `Toggle`, `Avatar`,
`Modal`, `PageHeader`, `EmptyState`, `ImgPlaceholder`, `Tabs`, `SectionTitle`.

**Toda a troca de secção usa `<Tabs>`** (pílulas segmentadas, `role=tablist`, navegação por ←/→).
`SectionTitle` é o eyebrow das secções dentro de `Card`. **Não reimplementar barras de tabs nem
eyebrows à mão.**

**`Modal` tem pilha:** os modais registam-se numa pilha ao nível do módulo — **Esc fecha só o do
topo** (antes um Esc destruía pilhas inteiras), com focus-trap no Tab e restauro do foco ao fechar.

**`GuardButton`** é o drop-in do `Button` para **escritas** quando o billing está read-only — nunca
para navegação, leitura, logout, portal Stripe ou chat de suporte. O interceptor 402
(`billing402.ts`) fica como backstop reactivo.

---

## Geração de código (Kubb)

`spec.json` → `src/gen/backoffice/hooks/` (React Query) e `src/gen/backoffice/types/`.
**Nunca editar `src/gen/` à mão.**

**Offline por defeito:** o `kubb.config.ts` gera **sempre** a partir do `spec.json` **committado**
(`input.path`). `pnpm kubb`/`dev`/`build` não precisam da API de pé — é determinístico e o CI não
depende dela.

- **Quando a API muda:** `pnpm kubb:refresh` (busca o spec, reescreve `spec.json`, regenera) e
  **committar o `spec.json`**. Sem a API a correr, a alternativa é `pnpm exec ts-node
  --transpile-only scripts/dumpSpec.ts backoffice > ../Backoffice/spec.json` na API.
- `VITE_API_BASE_URL` continua obrigatória (é o `baseURL` dos hooks) mas só precisa de estar
  **definida**, não de a API estar **a correr**.
- `kubb.config.ts` é tooling Node fora do `tsconfig` da app → `@ts-nocheck` no topo.
- **Atrás da Cloudflare com Bot Fight Mode**, o fetch do spec é bloqueado como bot. Header de bypass
  `X-CI-Bypass` com `CF_BYPASS_TOKEN` (build-time). ⚠ **NUNCA prefixar com `VITE_`** — senão vai
  parar ao bundle do browser. Só é enviado no refresh; não fica no `spec.json` nem no `src/gen/`.

---

## Autenticação (`AuthContext.tsx`)

- Login `POST /users/login` → `accessToken` **em memória** (+ `username`/`email` cacheados em
  localStorage para sobreviver a um reload — o JWT do BO nunca embute isso, só `userId`+`tokenVersion`).
- Refresh automático `POST /users/refresh` (cookie httpOnly) · CSRF de `/csrf-token` no header
  `x-csrf-token` · `authHeader()` para os hooks manuais.
- `setAccessToken(token)` — adopta um token novo sem passar por login/refresh (usado depois de
  `PUT /users/me/password`, que faz bump ao `tokenVersion`) e realinha o `scheduleRefresh`.
- `updateIdentity({username?, email?})` — sincroniza a identidade em memória + localStorage sem
  round-trip, para o avatar/topbar ficarem coerentes sem logout.

---

## Layout — alturas SEMPRE por flex (regra obrigatória)

**O `Shell` é o único dono da altura do viewport.** Nenhuma página ou componente mede o viewport à
mão: **proibido** `calc(100vh - Xpx)`, `h-screen`, `100dvh` e offsets fixos que adivinhem a altura
do chrome (topbar, títulos, banners).

O padrão é a cadeia flex: Shell = coluna `h-dvh` (topbar e `BillingBanner` como filhos normais) →
página recebe `flex-1 min-h-0` → tabelas/listas/threads fazem scroll **interno** (`overflow-auto`).

**Porquê:** qualquer px fixo codifica uma suposição sobre a altura dos irmãos, e essa altura **varia
em runtime** — o `BillingBanner` aparece e desaparece consoante o estado de billing. Tirar os
títulos do corpo das páginas (`1f320cc`) partiu tabelas e a página Mensagens exactamente por isso.

⚠ Ainda há medições fixas herdadas por varrer. Ao mexer numa página que as tenha, **converter para
flex** em vez de reajustar o número.

---

## Segurança e boas práticas

- Nunca expor `userId` nem dados de outros tenants nas queries.
- Usar sempre `authHeader()` nos hooks manuais (nos gerados, o cliente axios já o injecta).
- Uploads de imagem/vídeo via `/api/uploads` — **nunca base64 em JSON**.
- **Upload diferido:** os ficheiros escolhidos ficam locais (preview `blob:`) e só são enviados
  quando o utilizador carrega em **Guardar** — nunca ao escolher. Evita órfãos no storage se o
  formulário for cancelado. Aplica-se a Ginásio (`MediaGallery` + `uploadPendingMedia`), Loja (foto
  do produto) e Conteúdos/CMS (imagens das entradas).
