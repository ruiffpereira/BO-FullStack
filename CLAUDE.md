# CLAUDE.md — Backoffice

Vite + React + TypeScript + TailwindCSS + React Query (gerado por Kubb).
Backoffice multi-tenant — um único deploy serve todos os clientes da plataforma.

---

## Comandos

```bash
pnpm dev          # gera código Kubb + inicia Vite (porta 5173)
pnpm build        # gera código Kubb + build de produção
pnpm kubb         # regenera hooks/types a partir do spec OpenAPI da API
pnpm lint         # tsc --noEmit (type check)
pnpm test:unit    # testes de componentes (Vitest + RTL + jsdom) — isolados, sem servidor
pnpm test:e2e     # testes end-to-end (Playwright) — precisam da app + API a correr
```

A API deve estar a correr no URL de `VITE_API_BASE_URL` (dev: `http://localhost:3001/api`, via `.env.development`).

---

## Envs (obrigatórias — SEM defaults)

**Regra do projeto: nenhuma env tem default silencioso.** Se faltar, é ERRO — o build recusa, nunca se embute um valor de fallback.

| Env | Para quê | Dev | Prod |
|-----|----------|-----|------|
| `VITE_API_BASE_URL` | Base da API | `http://localhost:3001/api` | URL real da API |
| `VITE_SITE_ROOT_URL` | Base pública dos sites dos tenants (página Website: `{sub}.{host}`) | `http://localhost:3000` | ex.: `https://rufvision.com` |

- **Onde vivem os valores:** dev → **`.env.development`** (commitado) · e2e → `.env.test` (gitignored; o CI gera-o) · **prod → build-time variables no Coolify** (as `VITE_*` ficam embutidas no bundle no momento do build — mudá-las em runtime não faz nada).
- **Enforcement em 3 camadas:** `vite.config.ts` (guard com `loadEnv` — build/dev-server falham logo com a lista do que falta) · [`src/lib/env.ts`](src/lib/env.ts) (único ponto de leitura no código: exporta `API_BASE` e `SITE_ROOT_URL`, throw como backstop; **nunca ler `import.meta.env` diretamente nem escrever `?? "http://localhost..."`**) · `kubb.config.ts` (exige `VITE_API_BASE_URL`; lê env real > `.env` > `.env.development`). O vitest injeta os valores via `test.env` no `vitest.config.ts`.
- **`.env` é local e gitignored** (só segredos/overrides pessoais, ex.: `SWAGGER_ACCESS_TOKEN`). **NUNCA commitar um `.env`:** o Vite carrega-o em TODOS os modos, incluindo o build de produção — um `.env` commitado com valores de dev satisfaz o fail-fast com o valor errado (foi o bug do `teste1.localhost:3000` em produção, 2026-07-02).

---

## Testes

Duas camadas, ambas em `tests/`:

- **Componentes (`tests/unit/`, Vitest + React Testing Library + jsdom):** testes unitários e isolados dos componentes/páginas — sem servidor nem API. Config em `vitest.config.ts`, setup em `tests/unit/setup.ts` (stub do `scrollIntoView`, matchers `jest-dom`). Hooks gerados (Kubb)/manuais que tocam a API são mockados (`vi.mock`). Cobertos: **Combobox, ConfirmDialog, DatePicker, DateRangePicker, FileUpload, ApptModal, NotificationsPanel** e a página **Estatísticas** (`Estatisticas.test.tsx` — mocka `useSiteAnalytics` para os 3 estados: `no-plausible`, `no-domain` com input de domínio, e configurado com KPIs). Correr: `pnpm test:unit`.
- **End-to-end (`tests/e2e/`, Playwright):** fluxos reais no browser (Chromium). Correr: **`pnpm test:e2e`** — não precisa de nada ligado à mão (~87 testes, serial). Specs: admin, **admin-tokens**, agenda, **agenda-pagamentos**, **auth-setup-password**, auth, clientes, conteudos, **conteudos-multilingua**, dashboard, despesas, errors, financeiro, ginasio, **ginasio-detalhe**, loja, **loja-encomendas**, **notificacoes**, **chat** (suporte Admin↔tenant — round-trip + vistas por papel + topbar/bolinha), **rbac** (matriz de permissões), **isolamento** (multi-tenant, incl. deep-link), security. Page objects em `tests/e2e/pages/`; helper `fixtures/login.ts` (`loginAs`) para autenticar tenants específicos.

**Infra isolada (NUNCA toca em dev):** o `playwright.config.ts` arranca **dois** servidores próprios e semeia uma BD dedicada antes de tudo:
> - **API de teste** em `:3002` (`ENVIRONMENT=TEST`, `API-FullStack/.env.e2e`) ligada à BD **`api_e2e`** no `mysql-test:3307` (separada do `api_test` dos testes de integração e do dev). Comando: `pnpm serve:e2e` (na API).
> - **Vite** em `:5273` com `--mode test` → lê `Backoffice/.env.test` (`VITE_API_BASE_URL=…:3002`).
> - **`globalSetup`** (`tests/e2e/global-setup.ts`) corre `pnpm seed:e2e` (→ `API-FullStack/scripts/seedE2e.ts`): recria o schema (`sync force`) e cria **4 tenants** com passwords conhecidas — `admin@e2e` (Admin), `limited@e2e` (só `VIEW_PRODUCTS`), `tenantA@e2e`/`tenantB@e2e` (Admin, com dados distintos) — e dados de negócio (clientes, produtos, despesas, **marcações pagas/em dívida/pendentes**). Password: `E2ePass123!`.

**Autenticação:** os specs gerais importam `{ test, expect }` de `tests/e2e/fixtures/auth.ts` (login por teste como `admin@e2e`). Os specs de **RBAC/isolamento** importam `loginAs(context, "<user>@e2e")` de `tests/e2e/fixtures/login.ts` + `test.use({ storageState: vazio })` para autenticar um tenant específico. Os specs `auth`/`security` correm de propósito **sem** auth e o `errors` intercepta a API.

> **Notas:**
> - Toda a escrita de dados acontece em `api_e2e` (recriada a cada `pnpm test:e2e`) — **nunca polui a BD de dev**.
> - Os modais expõem `role="dialog"` e o `Input` partilhado tem `type="text"` por defeito (`ui/ui.jsx`) — os page objects dependem disso.
> - O `authRateLimit` da API isenta o **loopback** fora de produção (`src/middleware/security.ts`).
> - Marcações semeadas precisam de `serviceId` válido (o frontend assume serviço associado).

---

## Estrutura

```
src/
  pages/          — páginas principais (uma por rota)
  components/     — componentes partilhados
  hooks/          — hooks manuais (não gerados pelo Kubb)
  gen/backoffice/ — código gerado pelo Kubb (não editar manualmente)
    hooks/        — 129 hooks React Query
    types/        — tipos TypeScript dos endpoints
  context/        — AuthContext (JWT + refresh automático)
  lib/            — utilitários (apiError, etc.)
  ui/             — componentes de UI base (Card, Button, Input, Modal, Icon, etc.)
  utils/          — langFlag.tsx e outros utilitários
```

---

## Páginas e Permissões

| Página | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `Admin.tsx` | `/admin` | `VIEW_ADMIN` | Utilizadores, permissões, componentes RBAC, site tokens, línguas, **Faturação** (painel de subscrições da plataforma do dono — `AdminBillingTab` de `src/components/AdminBilling.tsx`: **editor do catálogo de preços** por módulo — label + preço/mês em € + toggle ativo, via `useGetAdminBillingCatalog` + `usePutAdminBillingCatalogModule` (a API fala em cêntimos; conversão €↔cents em `src/lib/billingStatus.ts`: `centsToEurInput`/`parseEurToCents`) — lista tenants + estado/módulos/total via `useGetAdminBillingSubscriptions`, e cria subscrições com **override de preço opcional por módulo** (`items:[{module, amountCents?}]`, vazio = preço do catálogo) via `usePostAdminBillingSubscriptions`, mostrando o `monthlyTotalEur` devolvido — T6 + Fatia 2 preços. **Estender trial** (self-serve, T10): ação por linha só nos tenants com subscrição `trialing` (cobre trial local self-serve e `trial_expired` — ambos partilham esse `status` na BD; a API devolve 409 se afinal for Stripe-backed) — input de dias (default 14) → `PATCH /admin/billing/subscriptions/:userId/trial` via `usePatchAdminBillingSubscriptionsUseridTrial`, invalida subscrições+catálogo), **Atividade** (audit log unificado — ações + erros 5xx, com filtro "Só erros"), **Sistema** (health) e **Integrações** (Google Calendar sync + Reviews — `useGoogleIntegration.ts`; OAuth env-gated) |
| `Agenda.tsx` | `/agenda` | `VIEW_SCHEDULE` | Calendário de agendamentos, serviços, horários, bloqueios + card **Subscrever calendário** (feed .ics da agenda, `CalendarSubscribeCard`). Grelha **00–24h** (`AG_H_START=0`/`AG_H_END=24`, `AG_ROW_H=80px`) com **scroll a arrancar nas 8h** (`AG_SCROLL_START_H`, via callback-ref no contentor de scroll), **ticks de 15 min** (linha de hora forte + 15/30/45 min ténues), e um **toggle de exibição da hora** na barra (`cellTimeMode`, persistido em localStorage): **Sempre** = hora discreta em cada célula de 15 min · **Ao passar** = realce + pílula accent `DD/MM · HH:MM` só no hover (`hoverSlot`). O drag-to-create faz snap a 15 min. No tab **Pagamento** do `ApptModal`, pílulas **Dinheiro/MBway/Cartão** que preenchem o valor do serviço num clique (`PriceFillChip`). Cursor **dedo** (`pointer`) em repouso → **`crosshair`** ao arrastar para criar (condicional em `dragSel`) |
| `Clientes.tsx` | `/clientes` | **core** (todos) | **Tab de topo** `Clientes`/`Leads` (`?tab=`, mesmo padrão `?tab=` da Loja — lê a URL ao montar/mudar, não escreve de volta ao clicar). Tab **Clientes**: lista de clientes; ficha com **tabs por permissão** (cabeçalho fixo + tab **Agenda** se `VIEW_SCHEDULE` = stats/histórico, tab **Ginásio** se `VIEW_GYM` = mensalidade do cliente via `ClienteMensalidade`). Tab **Leads** (`LeadsInbox`, `src/pages/clientes/LeadsInbox.tsx`): inbox dos pedidos de contacto/orçamento capturados no form do site público do tenant (`POST /websites/leads` → `Lead`, API). Separadores **Novos/Todos/Arquivados** (`useGetLeads({status})`, mais recentes primeiro), badge de estado PT (novo/lido/arquivado; tokens EN `new/read/archived`), mensagem truncada com "Ver mais/menos", ações **Marcar como lida**/**Arquivar** via `usePatchLeadsId` atrás do write-guard (`GuardButton`/`useWriteGuard`, PATCH está atrás do `billingGate`). Expandir um lead **novo** marca-o como lido automaticamente (silencioso, sem toast). Deep-link `?tab=leads&lead=<id>` (notificação de novo lead) muda para "Todos", salta de página, expande e realça o lead |
| `Conteudos.tsx` | `/conteudos` | **core** (todos) | CMS multi-língua: secções, entradas, textos, imagens |
| `Dashboard.tsx` | `/` | qualquer | Topo: **`FirstValueChecklist`** (self-serve, T11 — `src/components/FirstValueChecklist.tsx`) — checklist por vertical derivada das permissões + dados já existentes (nenhum endpoint novo): `VIEW_SCHEDULE`→criar serviço/definir horário/partilhar link · `VIEW_GYM`→criar subscrição/adicionar cliente/registar cobrança · `VIEW_PRODUCTS`→criar produto/rever encomendas · core→adicionar cliente/explorar conteúdos. Itens são deep-links, auto-completam-se com os dados (o item "partilhar link"/"rever encomendas"/"explorar conteúdos" fica sempre por marcar — sem sinal de dados fiável), dispensável (`localStorage` por `userId`), colapsa a acordeão `<md`. **Vertical-aware** (brief em `.design/dashboard-vertical/`): compõe-se a partir das permissões do tenant em vez de assumir "negócio de marcações". **Espinha** (peça central) escolhida por prioridade operacional — `VIEW_SCHEDULE`→**"Hoje"** (`DayRail`: timeline + próximo + marcador "agora") · senão `VIEW_GYM`→**"Cobranças · {mês}"** (`GymCobrancasSpine`: recebido/previsto + por cobrar/em atraso/MRR + lista de em atraso clicável) · senão `VIEW_PRODUCTS`→**"Por despachar + Vendas hoje + últimas + stock"** (`FulfillmentSpine`) · senão core→`CustomersWelcome`. **Faixa de KPIs** (até 4, sem o antigo corte `slice(0,4)` arbitrário): **Receita de hoje agregada** (agenda+loja+ginásio, via `useDashboard('today')`) + uma âncora por vertical (Marcações hoje · Em atraso/Por cobrar · Por despachar/Vendas · Clientes novos) + fillers. **Carris** de apoio para as outras verticais (estado do mês · `GymMiniCard` · últimas encomendas · `StockAlerts`). **Cada KPI/linha é clicável** (deep-link: `/agenda?data=` · `/financeiro?vista=ginasio` · `/loja?tab=encomendas` · `/clientes?cliente=`), mesmo padrão de afordância das notificações. Dados reais de `GET /api/dashboard?period=today` (schedule+ecommerce+gym+expenses) + `useGetGymMensalidadeFinance` + listas (appointments/orders/customers). Clientes tratado como **core** (sem gate `VIEW_CUSTOMERS`) |
| `Estatisticas.tsx` | `/estatisticas` | **core** (todos) | Estatísticas do site público do tenant via **Plausible auto-hospedado** (`useSiteAnalytics.ts`). Selector de período (**Hoje**/7 dias/30 dias/Este mês/6 meses; **default `month` = "Este mês"**), KPIs (Visitantes, Visualizações, Taxa de saída, Duração média), `LineChart` de visitantes, listas de **páginas mais vistas** e **origem do tráfego**. Estados: `no-plausible` (admin tem de configurar) · `no-domain` (input para guardar o domínio via PUT) · dashboard. Env-gated no servidor; a key do Plausible nunca chega ao browser. **Nota Plausible:** `7d`/`30d` terminam *ontem* (não incluem hoje); `day` (Hoje) e `month` (Este mês) incluem o dia corrente — por isso o default é `month` (um site novo com visitas só de hoje veria 0 em 30d) |
| `Faturacao.tsx` | `/faturacao` | **core** (todos) | **Platform billing** (a subscrição da plataforma do próprio tenant; brief/tarefas em `.design/platform-billing/` + `.design/self-serve/`). Lê `useGetBillingSubscription` (`GET /api/billing/subscription` → `{ status, modules[], monthlyTotalEur, readOnly, reason, graceEndsAt, hasStripeSubscription, … }`; `reason` ∈ none/trialing/**trial_expired**/active/incomplete/grace/past_due_locked/canceled) e mostra o plano (módulos + total/mês), o aviso de estado e o CTA certo para cada caso. **Dois CTAs distintos, nunca os dois ao mesmo tempo** (decididos por `hasStripeSubscription`, exposto pela API — nunca o `stripeSubscriptionId` em si): **"Gerir pagamento"** abre o **Stripe Billing Portal** via `usePostBillingPortal` (`POST /api/billing/portal` → redirect) — só quando `hasStripeSubscription` (já existe uma subscrição Stripe real, mesmo cancelada, para faturas antigas). **"Adicionar cartão"/"Reativar subscrição"** (self-serve) cria uma **Stripe Checkout Session** via `usePostBillingSubscribe` (`POST /api/billing/subscribe` → `{ url }`, redirect) — quando `!hasStripeSubscription` (trial local do signup, incl. `trial_expired`) **ou** `status==='canceled'` (o Billing Portal não ressuscita uma subscrição Stripe já cancelada; o self-serve cria uma nova, honrando os dias de trial local restantes). 409 do subscribe = já tem uma subscrição viva → toast a apontar para "Gerir pagamento". Badges/labels e formatos partilhados em `src/lib/billingStatus.ts` |
| `Signup.tsx` | `/signup` | **público** (sem sessão, standalone como `Login.tsx`/`SetupPassword.tsx`) | **Signup self-serve** (T8, brief `.design/self-serve/`): par do Login, 2 passos + 1 estado final. Passo 1 — vertical (radio cards Barbearia/Salão · Ginásio · Loja · Outro, `?vertical=` pré-seleciona se válido) + nome do negócio + email. Passo 2 — módulos pré-marcados pela vertical (mapa único `VERTICAL_MODULES` em `src/lib/verticals.ts`, extensível) mas editáveis, com preço de `GET /billing/catalog` (**público**, `useGetBillingCatalog`, sem auth) + total €/mês live + badge "14 dias grátis, sem cartão". Submeter → `usePostUsersSignup` (`POST /users/signup`) → SEMPRE o mesmo ecrã "Confirma o teu email" (`role=status`, anti-enumeração — a API responde sempre `{ok:true}`), com reenvio (`usePostUsersSignupResend`, cooldown de 60s). Foco gerido entre passos (heading recebe foco). Link "Criar conta" no `Login.tsx`; volta a `/login` |
| `FinanceiroPage.tsx` | `/financeiro` | **core** (todos) | Página "Financeiro" com tabs **O Negócio** (`Financeiro.tsx` — dashboard que agrega agenda/loja/**ginásio**+despesas), **Despesas** (`Despesas.tsx`) e **Ginásio** (`MensalidadesTab` de `GymMensalidade.tsx` — mensalidades+subscrições; só `VIEW_GYM`). `/despesas` é deep-link que abre a tab Despesas (não está na sidebar). **KPIs condicionais por negócio (tab O Negócio):** Receita/Despesas/Lucro aparecem sempre; **Clientes novos** só com Loja (`ecommerce`); **Vendas / Marcações** e **Ticket médio** só com Loja ou Agenda (pressupõem transações avulsas). Um tenant só de ginásio (mensalidades recorrentes) vê apenas Receita/Despesas/Lucro — flags `hasEcom`/`hasSales` em `Financeiro.tsx` |
| `Ginasio.tsx` | `/ginasio` | `VIEW_GYM` | Ginásio: exercícios, treinos, planos, programas/progresso por cliente (`/api/gym`). **Mensalidades vivem no Financeiro** (tab Ginásio), não aqui |
| `Loja.tsx` | `/loja` | `VIEW_PRODUCTS` | Produtos, categorias, subcategorias, encomendas, cupões |
| `Mensagens.tsx` | `/mensagens` | **core** (todos) | **Chat de suporte** (Admin↔tenant). Admin (`VIEW_ADMIN`) → inbox de todos os tenants (`MensagensTab`); tenant → a sua conversa com o suporte. 3 pontos de acesso: item na sidebar + ícone no topbar (`ChatLauncher`) + botão flutuante (`ChatFab`, some na própria página). Ver secção **Chat de Suporte** |
| `Website.tsx` | `/website` | **`VIEW_ADMIN`** (temporário — ver nota) | **Site engine** (config do site público do tenant; brief/tarefas em `.design/site-engine/`). 5 tabs (`Tabs`): **O meu site** (estado rascunho/publicado + checklist + Publicar), **Template** (4 verticais de `siteTemplates.ts`), **Páginas** (gestor de páginas, T23 — `PagesTab`: lista ordenada por `order`, criar/remover/reordenar/editar título+slug/toggle nav/tipo conteúdo·coleção), **Marca** (preset/accent/fonte/logo + mini-preview local), **Domínio** (check + reclamar subdomínio). Hook manual `useWebsite.ts` (padrão `useChat`, sem Kubb) → `/api/website` (GET/PUT — aceita substituição total do array `pages`), `/website/subdomain/check|/subdomain`, `/website/publish`. **Reclamar o subdomínio sincroniza também o domínio das Estatísticas** (`User.websiteDomain`/Plausible → `<sub>.<SITE_ROOT_DOMAIN>`, feito na API) quando o valor atual é herdado (vazio/localhost/host antigo do root domain) — nunca pisa um domínio próprio; o `useSetSubdomain` invalida a cache `["site-analytics"]`. O site é renderizado por um app Next.js à parte (`d:\Projetos\Projectos\site-engine`, repo próprio). **Gestor de páginas (`PagesTab`):** cada linha edita `title`/`slug` inline (`onBlur`/Enter), toggle `inNav`, seletor `kind` (`content`/`collection`, tokens EN), setas para reordenar (recalcula `order` = índice em qualquer mutação), e remover com `ConfirmDialog` — bloqueado para a página inicial (slug `""`, convenção de `site-engine/lib/site.ts::findPage`) e para a última página restante. Slug novo é sugerido por `slugify()` do título (minúsculas, sem acentos, `[a-z0-9-]`) e validado contra duplicados + uma lista de **rotas reservadas** lida de `site-engine/app/**`: `carrinho`, `checkout` (+ `checkout/sucesso`), `loja` (+ `loja/[produto]`), `api`, `robots.txt`, `sitemap.xml`. Cada ação persiste de imediato via `useSaveSite({ pages })` (substituição total do array, ordem recalculada). **Gestor de blocos por página (T24, dentro da tab Páginas):** ao selecionar uma página (`IconButton` "Gerir blocos", `layers`) aparece `PageBlocksSection` — lista os `blocks[]` da página (ordem = índice do array, sem campo `order` próprio) com setas reordenar, `Combobox` de variante, `Badge` da variante, resumo (`summarizeBlock`) e remover (`ConfirmDialog`). "Adicionar bloco" abre uma grelha de tipos (`BlockPaletteModal`, agrupada Conteúdo/marketing vs Funcionais). Catálogo único em `src/lib/blockCatalog.ts` (`BLOCK_SCHEMAS`, PT labels/descrições, tokens EN) para os 14 tipos do `BlockRenderer` do site-engine (`nav`/`footer` são chrome, fora do array `blocks`): **10 com formulário rico** por tipo (hero/about/stats/services/gallery/testimonials/cta/faq/pricing/contact — campos tipados, incl. listas de string e listas de itens com add/remover/reordenar) e **4 com editor genérico chave/valor** (booking/products/gym/lead — e fallback de qualquer tipo desconhecido; valores objeto/array editam-se como JSON num textarea, com preservação do rascunho se o JSON for inválido). Conteúdo é sempre inline por língua (`block.settings.content[locale]`, nunca `contentRef` — fica um TODO do renderer); o `BlockContentModal` mostra uma `Tabs` por língua ativa com um draft local, e "Guardar" faz **merge** com o `content` existente (preserva línguas desativadas) antes de persistir. Toda a escrita (adicionar/mover/variante/remover/guardar conteúdo) reusa o mesmo `persist` (substituição total do array `pages`) do T23 — sem endpoint novo. **Nota:** ainda em construção (falta preview iframe/ao vivo) → **escondido dos tenants**, gated a `VIEW_ADMIN` no `Shell.tsx` (removido de `CORE_PATHS`); **passar a core** quando pronto |

A navegação em `Shell.tsx` decide **o que** aparece por duas famílias e **a ordem** por um array fixo:
- **Core (todos os tenants, sem permissão):** Dashboard · **Estatísticas** · **Clientes** · **Mensagens** · **Financeiro** (Negócio + Despesas) · **Conteúdos**. No backend, `/customers`, `/expenses`, `/cms`, `/dashboard`, `/analytics` e `/chat/support` só exigem `authenticateToken` (dados scoped por `userId`).
- **Módulos (por permissão, em `MODULE_PERM_TO_PATH`):** Agenda (`VIEW_SCHEDULE`) · Loja (`VIEW_PRODUCTS`) · Ginásio (`VIEW_GYM`). **Admin** (`VIEW_ADMIN`) à parte.
- **Ordem da sidebar** (`MENU_ORDER`): Dashboard · Estatísticas · Admin · Clientes · Mensagens · Conteúdos · Loja · Agenda · Ginásio · Financeiro. As rotas acessíveis (conjunto core+módulos+admin) são apresentadas por esta ordem fixa; itens não listados vão para o fim. O redirect inicial continua a usar `accessiblePaths[0]` (= Dashboard, que todos têm).
- `/despesas` continua a funcionar como **deep-link** (abre o Financeiro na tab Despesas) mas **não** aparece na sidebar; o guard de rotas usa `allowedPaths = accessiblePaths + /despesas`.

---

## Componentes Partilhados

> **Primitivas de UI (`src/ui/ui.jsx`):** `Card`, `Button`, `IconButton`, `Badge`, `Input`, `Select`, `Toggle`, `Avatar`, `Modal`, `PageHeader`, `EmptyState`, `ImgPlaceholder` e — **frame partilhado entre páginas** — `Tabs` e `SectionTitle`. **Toda a troca de secção usa `<Tabs>`** (pílulas segmentadas: contentor `bg-zinc-100` + ativo `bg-white shadow-sm text-accent`, com `role=tablist` + navegação por ←/→). Props: `tabs={[{id,label,icon?}]}`, `value`, `onChange`, `fullWidth?` (estica, ex.: tabs da ficha do cliente), `size?` (`sm`/`md`). `SectionTitle` é o eyebrow das secções dentro de `Card` (`text-xs uppercase tracking-wide`, com slot `right` opcional). **Não reimplementar barras de tabs nem eyebrows à mão.**

| Componente | Descrição |
|------------|-----------|
| `Shell.tsx` | Layout principal: sidebar, topbar, notification bell + **`BillingBanner`** (acima do `<main>`) |
| `BillingBanner.tsx` | Faixa de billing no topo do Shell (platform billing, T5). Lê `useGetBillingSubscription` e só aparece quando é preciso agir: `trialing` a ≤3 dias do fim (info azul, `role=status`, **dispensável** — persiste em localStorage por período), `grace` (âmbar, `role=status`), `past_due_locked`/`canceled`/**`trial_expired`** (self-serve, T9 — vermelho, `role=alert`, não dispensável; `trial_expired` mostra um link extra "Falar com o suporte" → `/mensagens` além do "Ver faturação"). Invisível quando pago (none/active/incomplete/trial-longe) e na própria `/faturacao` |
| `GuardButton.tsx` | **Write-guard proativo** de platform billing (roadmap 0.4 / dívida T5). Drop-in do `Button` partilhado: em operação normal é idêntico ao `Button`; quando a subscrição está **read-only** (`useWriteGuard().readOnly` — pagamento em atraso além do grace / cancelada) o botão fica **desativado** com o motivo (title no hover + `aria-disabled`, `WRITE_GUARD_MESSAGE` a apontar p/ Faturação). Aplicado aos CTAs de escrita primários: Agenda (Nova/Criar marcação, Guardar marcação em `ApptModal`, Guardar serviço), Loja (Novo produto, Guardar/Adicionar produto), Clientes (Criar/Guardar cliente), Ginásio-mensalidades (Marcar pago/paga, Criar/Guardar subscrição, Atribuir), Conteúdos/CMS (Guardar entrada/secção/línguas). O botão "Pagar" cru do `ApptModal` lê `useWriteGuard()` diretamente. **Só para escritas** — nunca navegação, leitura, logout, portal Stripe ou chat de suporte. O interceptor 402 (`billing402.ts`) mantém-se como backstop reativo. Testes: `writeGuard.test.tsx` |
| `Login.tsx` | Formulário de login (standalone, sem Shell). Link "Criar conta" → `/signup` (self-serve, T8) |
| `NotificationBell.tsx` | Ícone com badge + dropdown de notificações em tempo real |
| `ApptModal.tsx` | Modal de criação/edição de agendamentos (usado em Agenda) |
| `FileUpload.tsx` | Upload de imagem único para SeaweedFS via `/api/uploads` (atualmente sem uso) |
| `MediaGallery.tsx` | Galeria de imagens/vídeos (Ginásio). **Upload diferido**: segura os ficheiros localmente (preview `blob:`) e só os envia ao Guardar, via `uploadPendingMedia()` |
| `Combobox.tsx` | Dropdown custom com pesquisa. Menu renderizado em **portal** (`document.body`, posição fixa) para não ser cortado por overflow de modais. `ref` aponta para o botão; tem `label`/`disabled` |
| `DateRangePicker.tsx` | Selector de intervalo de datas (`react-day-picker`, modo range, locale PT). Usado ao atribuir um programa |
| `TranslationInputs.tsx` | Campos de tradução por língua com bandeiras reais |
| `PriceFillChip.tsx` | Pílula que preenche um campo de valor com um preço de referência (preço do serviço na Agenda / da subscrição no ginásio) num clique. Usada no `ApptModal` (pagamento) e no `PagamentoModal` do gym (`GymMensalidade.tsx`). Props: `amount`, `label`, `onClick`, `active?` |
| `chat/*` | **Chat de suporte** (Admin↔tenant). Entradas (para todos): `ChatLauncher` (ícone no topbar) + `ChatFab` (botão flutuante, some em /mensagens) — ambos navegam para `/mensagens` com badge de não-lidas (`useChatUnread`). A página `Mensagens.tsx` mostra `MensagensTab` (inbox do Admin) ou a conversa do tenant. Partilhados: `ChatConversationView` (liga hooks + envio otimista + marca lida + paginação), `MessageThread`/`MessageBubble`/`DayDivider` (bolhas + "visto"), `Composer` (textarea auto-grow + anexos de imagem com upload diferido). Ver secção **Chat de Suporte** |

---

## Hooks Manuais (src/hooks/)

| Hook | Descrição |
|------|-----------|
| `useSettingsLanguages.ts` | GET/PUT das línguas activas e língua padrão do tenant |
| `useCmsSearch.ts` | Pesquisa de entradas CMS por contexto e língua |
| `useNotifications.ts` | Lista e acções sobre notificações do tenant |
| `useSSE.ts` | Ligação SSE para notificações em tempo real |
| `usePushSubscription.ts` | Subscrição Web Push (subscribe/unsubscribe) |
| `useDashboard.ts` | GET `/api/dashboard?period=` tipado (schedule + ecommerce + **gym** + expenses) para a tab "O Negócio" do Financeiro |
| `useAuditLogs.ts` | `useAuditLogs` (registo unificado; `errors:"true"` filtra 5xx) / `useHealth` — tabs Atividade e Sistema do Admin (só `VIEW_ADMIN`) |
| `useSiteAnalytics.ts` | `useSiteAnalytics(period)` (GET `/api/analytics/site`) + `useSiteDomain`/`useSetSiteDomain` (GET/PUT do domínio). Alimenta a página **Estatísticas**; fala só com a nossa API (a key do Plausible fica no servidor) |
| `useScheduleCalendar.ts` | `useScheduleCalendarFeed` (GET `/api/schedule/calendar` → URL .ics da agenda, gera token na 1.ª vez) + `useRotateScheduleCalendarToken` (POST `/rotate`). Alimenta o `CalendarSubscribeCard` da Agenda |
| `useChat.ts` | **Chat de suporte** (tipos locais; sem Kubb). Tenant: `useSupportThread`/`useSendSupportMessage`/`useMarkSupportRead`. Admin: `useAdminConversations`/`useAdminThread`/`useSendAdminMessage`/`useMarkAdminRead`. + `fetchOlderMessages` (paginação) e `mergeMessages` (merge por id). O `useSSE.ts` invalida `["chat"]` no evento `message` |
| `useBillingReadOnly.ts` / `useWriteGuard.ts` | Fonte única do **write-guard** de platform billing. `useBillingReadOnly()` → `{ readOnly, reason }` derivado de `useGetBillingSubscription` (cache do React Query, sem rede extra). `useWriteGuard()` → `{ readOnly, reason, message }` (`WRITE_GUARD_MESSAGE`, PT). Alimenta o `GuardButton` (drop-in do `Button`) e CTAs de escrita não-`Button` (ex.: "Pagar" no `ApptModal`). Complementa o backstop reativo 402 (`billing402.ts`) |

> Despesas usa hooks gerados pelo Kubb (`useGetExpenses`, `useGetExpensesSummary`, `usePostExpenses`, …) para as despesas, e o hook manual `useExpenseCategories.ts` (list/create/update/delete) para as **categorias criadas pelo tenant**. As categorias têm cor própria; `src/utils/expenseCategories.ts` só guarda a paleta de cores sugeridas.

---

## Ginásio (Ginasio.tsx)

Página com 5 tabs (por ordem do fluxo): **Exercícios** (catálogo), **Treinos** (bundles reutilizáveis = `WorkoutTemplate`), **Planos**, **Programas** (por cliente) e **Progresso** (por cliente). Tab default = Exercícios. Usa hooks gerados pelo Kubb (`useGetGymExercises`, `useGetGymMuscleGroups`, `useGetGymPrograms`, `useGetGymWorkoutTemplates`, `useGetGymPlanos`, …).

- **Hierarquia**: Exercício (+presets) → **Treino** (conjunto de exercícios reutilizável, sem dias = `WorkoutTemplate`) → **Plano** (lista de treinos; cada treino tem dia(s) da semana **obrigatório(s)** + exercícios) → **Programa** (plano atribuído a um cliente, com `startDate`/`endDate`).
- **Modelo do Plano** (`PlanoModal`): um plano é uma **lista de treinos** (cada treino = um `PlanoWorkout` na API: `name` + `daysOfWeek` + `exercises`). Cada treino exige ≥1 dia da semana e ≥1 exercício (validação no Guardar). **Vários treinos podem partilhar o mesmo dia.** Por treino podes **associar um treino existente** (`associateTemplate` → copia nome + exercícios como *snapshot*; herda o nome se vazio) ou montar de raiz adicionando exercícios do catálogo. Editar dentro do plano **não** afeta o `WorkoutTemplate` original. Sem alterações na API — a estrutura `Plano → PlanoWorkout → PlanoWorkoutExercise` já encaixa.
- **Atribuir** (`PlanosTab` → "Atribuir"): copia o plano para um **Programa** novo do cliente (*snapshot*). Editar o programa do cliente **não** afeta o template e vice-versa. As datas escolhem-se com o `DateRangePicker` (react-day-picker).
- **No `ProgramasTab`** podes encher um programa de duas formas: botão **"Plano"** (adiciona os treinos de um plano, **com os dias**, ao programa) ou botão **"Treino"** (`WorkoutModal` — cria um treino, opcionalmente **associando um treino existente** que copia os exercícios). **Os treinos de um programa têm dia(s) da semana obrigatório(s)** (validação no `WorkoutModal`). Não há atalho para atribuir um treino sem dias.
- **Programa ativo** (`ProgramasTab`): o coach marca **um** programa como ativo por cliente (botão "Tornar ativo" → badge "★ Ativo"). Ativar um desativa os outros (regra na API). Chama `PATCH /gym/programs/:id/active` via `axiosInstance` (não há hook Kubb; o campo `active` lê-se com `(p as any).active` até regenerar o Kubb). É o programa que aparece ao cliente na PWA. **Datas são só informativas** — não expira nem ativa sozinho; só o coach muda. Ao atribuir um plano/criar programa, se o cliente ainda não tem ativo, este fica ativo automaticamente.
  - **Lado PWA** (`GET /websites/gym/programs/active`): devolve o programa ativo + `nextWorkoutId` (o "treino a fazer agora" = o **menos vezes concluído**, empate → ordem; faltar/saltar treinos é tratado por esta regra) + `weeklyGoal` (nº de dias da semana do programa). O cliente pode na mesma escolher outro treino manualmente.

- **Grupos e subgrupos musculares** (`/api/gym/muscle-groups`): hierarquia de 1 nível via `parentId` (ex: *Peito → Peito superior*). Geridos no modal "Grupos" do Catálogo. A cor de um novo grupo/subgrupo vem **aleatória** de `GROUP_COLORS` (o user pode mudar). Apagar um grupo apaga os seus subgrupos (os exercícios guardam o nome em snapshot, por isso não corrompem).
- **Catálogo de exercícios** (`/api/gym/exercises`): cada exercício pertence a um grupo de topo e, opcionalmente, a um `subGroup`. Em vez de um único conjunto de defaults, tem **presets nomeados** (`presets: [{ id, name, sets, reps, weight, rest }]`, ex: "Iniciante", "Avançado"). Os campos `default*` legados são derivados do 1.º preset (compat com a PWA/público).
- **Montar treino** (`WorkoutModal`/`WorkoutTemplateModal`): ao adicionar um exercício do catálogo, se este tiver presets aparece um selector que pré-preenche séries/reps/peso/descanso — **continuam editáveis** por cliente. Os exercícios prescritos guardam snapshot de `group`/`subGroup`.
- **Exercícios de tempo + modos de plano (overhaul 2026-06-24):** presets e exercícios prescritos têm `type` — `"strength"` (séries/reps/peso) ou `"time"` (duração em segundos, ex: prancha/mobilidade) — mais `notes`. **Tokens em inglês no modelo, PT só na UI.**
- **Série-a-série + dropsets (overhaul 2026-06-25):** presets e exercícios prescritos de força têm `mode` — `"uniform"` (todas as séries iguais: `sets`×`reps`×`weight`×`rest`) ou `"perSet"` (cada série definida em `setRows`). Cada `setRow` é `{ reps, weight, rest, drop, steps }`; uma **série composta/dropset** tem `drop:true` + `steps:[{reps,weight,rest}]` (e `rest` é o descanso DEPOIS da série inteira). Os escalares `sets/reps/weight/rest` são **sempre derivados** de `setRows` (sets=nº de séries; reps/weight do 1.º passo) para compat com a PWA/recordes — `setRows` é puramente aditivo. No Backoffice: `SetRowsEditor`/`StrengthFields` (toggle Iguais/Série-a-série, com gestão de passos do dropset) são partilhados pelo editor de preset do catálogo e pelo `AjustarModal`. As 3 tabelas de prescrição (`WorkoutExercises`, `WorkoutTemplateExercises`, `PlanoWorkoutExercises`) ganharam colunas `mode` (string) + `setRows` (JSON); presets vivem no JSON `ExerciseCatalog.presets` (sem migração). Na PWA, uma série composta é **expandida num registo por passo** para que cada peso/reps fique registado nas estatísticas. Os `Plano`/`Program` têm `mode` `"weekly"` (dias da semana) ou `"free"` (dias numerados; cada treino tem `dayLabel` "Dia 1"). O `WorkoutModal` recebe o `mode` do programa e mostra `DaySelector` (weekly) ou input de `dayLabel` (free); o `PlanoModal` tem o toggle Semana fixa/Dias livres. "Editar o plano do cliente" = editar o **`Program`** (snapshot; não afeta a biblioteca). O tab **Progresso** usa gráficos reais de `src/ui/charts.jsx` (LineChart multi-série de evolução de carga + DonutChart de volume por grupo) alimentados por `GET /api/gym/clients/:id/stats` (`byGroup`, `progress`, `loadSeries`, `sessions`, `adherence`, `records`).
- **Mensalidades (2026-06-25):** é uma **tab dentro do Financeiro** (`FinanceiroPage.tsx` → tab "Ginásio", `VIEW_GYM`; ao lado de "O Negócio" e "Despesas"). *(Nota: o `Ginasio.tsx` tem um `MensalidadesTab` local que NÃO está ligado às tabs da página — código morto; o vivo é o `MensalidadesTab` de `GymMensalidade.tsx`.)* A receita das mensalidades **pagas** entra no `/api/dashboard` (bloco `gym`) e é agregada na tab **O Negócio** do Financeiro. A UI vive em `src/pages/GymMensalidade.tsx` (`MensalidadesTab`) com sub-tabs: **Cobranças** (`CobrancasView`), **Subscrições** (`SubscricoesTab`, catálogo CRUD: nome, preço, dia de vencimento, ativa) e **Análise** (`AnaliseView` — churn/retenção/LTV/MRR + tendência de 6 meses via `GET /gym/mensalidade/analytics`, hook `useGymAnalytics.ts`, gráfico `LineChart`). **Cobranças (cockpit, reinvenção 2026-06-26 — ver `.design/gym-cobrancas/DESIGN_BRIEF.md`):** seletor de mês (`finance?period=`), resumo *Recebido €X/€Y previsto* + Por cobrar/Em atraso/MRR, segmentação **Por cobrar · Pagos · Todos** + pesquisa, e lista (em atraso primeiro) com **uma** ação por linha — **Marcar pago** (abre `PagamentoModal`); clicar na linha abre a ficha. **Não há ações de mudar estado na linha** (evita enganos) nem botão **"Gerar mês"** — o mês é **automático** (cada membro com plano aparece "por cobrar"; marcar paga/dívida cria o `GymPayment` via upsert). Modelo na API: `GymSubscription` (catálogo) → `GymMembership` (cliente↔subscrição + `blocked`) → `GymPayment` (registo mensal: `period`, `amount`, `dueDate`, `status` **paid|debt|unpaid**, `paidAmount`/`debtSince` para dívida parcial; "Em atraso" é derivado; `updatedAt`/`createdAt` expostos por `serializePayment` para o carimbo **data+hora**). O componente partilhado **`ClienteMensalidade`** (exportado de `GymMensalidade.tsx`) é usado no drawer das Cobranças e na **ficha do cliente** (tab Ginásio): cartão único subscrição→mês corrente→bloqueio, mês corrente **automático** (efémero "por pagar" se ainda sem registo), confirmação ao baixar de "pago", e linha **"Registado a {data+hora}"**. Tokens EN no modelo, PT na UI. Endpoints: `/gym/subscriptions`, `/gym/mensalidade/*`.
  - **Separação de responsabilidades (uma fonte de verdade, três lentes):** a gestão por-cliente vive **só** em `ClienteMensalidade` (+ API) — reutilizado em dois pontos de entrada, **nunca forkar a lógica**. (1) **Financeiro → "O Negócio"** = lente do dinheiro, **só agregados** (mensalidades pagas entram agregadas via `/api/dashboard`); **nunca** lista clientes nem marca pagamentos. (2) **Financeiro → "Ginásio"** (`MensalidadesTab`, `VIEW_GYM`) = lente operacional (todos os clientes, cobrança, catálogo de subscrições, drill-down). (3) **Clientes → ficha → Ginásio** = lente da pessoa (um cliente; passa `dense` para empilhar). Regra-fronteira: o cruzamento por-cliente fica em (2)/(3); o tab **"O Negócio"** mantém-se **agregado** (não nomeia clientes).
  - **`ClienteMensalidade`**: cartão **único** (subscrição → mês corrente → bloqueio), com barra/badge de estado (`STATUS_VIEW`) na lateral. Prop `dense` (modal da ficha) só afeta o histórico (lista vs tabela) e o espaçamento. Mês corrente **automático** (sem "Gerar mês"). Datas via `DatePicker` da app; `Toggle` partilhado.
- **Evolução de carga por série (2026-06-25):** o `loadSeries` devolve, por exercício, `sessions: [{ date, sets:[{weight,reps}], e1rm }]` (todas as séries por treino + 1RM estimada média da sessão). O gráfico (`LineChart`) desenha **uma linha por índice de série** (peso em kg por treino) e mostra, por linha, a **% + Δkg** (1.ª→última sessão) e um badge de **força total** = variação da **1RM estimada (fórmula de Epley: `peso×(1+reps/30)`)** média, em **% e kg** (verde sobe / vermelho desce). Helper `epley1RM()` em `API-FullStack/src/utils/gym.ts`.

- **Traduções (CMS)**: os nomes de **exercícios, treinos (templates), planos (+ cada treino do plano), treinos de programa e grupos/subgrupos musculares** são traduzíveis via CMS, no **contexto `gym`** (separado do `website`, que é o site público do ginásio). Cada entidade guarda um `contentKey`; o valor na **língua padrão** é o fallback e as outras línguas vivem no CMS.
  - **UI**: componente `CmsCombo` (`src/components/CmsCombo.tsx`) — campo de **texto livre** para o nome, com **autocomplete de entradas CMS existentes** (`/cms/search?context=gym`) que se podem reutilizar ao clicar. **Não há botão "criar entrada"**: se não reutilizares nenhuma, a entrada é criada **ao Guardar** o formulário, via `ensureCmsName(contentKey, context, name, defaultLang)` (`src/lib/gymCms.ts`) — gera `gym.<uuid>` se não houver `contentKey` e grava o nome na língua padrão. O botão "Traduções" abre o `CmsTranslationsModal`. Usado em exercícios, treinos, planos (+ treinos), treinos de programa e grupos/subgrupos musculares. Controlado por `value` (contentKey) + `name` (texto); `onChange(key, name)`.
  - O contexto `gym` está registado no CMS: tab "Ginásio" em `Conteudos.tsx` e suporte no `searchController` da API (prefixo `gym.%`; excluído do separador website).
  - **Programas/Workouts por cliente herdam o `contentKey`** do plano/treino ao atribuir (snapshot), por isso não precisam de UI própria. A API resolve o nome pela **locale do cliente** (`localizeProgramDTOs` em `src/utils/gym.ts`); exercícios resolvem-se pelo `exerciseId`→catálogo e o grupo pelo nome→`MuscleGroup`.

> Todos os dropdowns da página usam o componente custom `Combobox` (com pesquisa), não os `<select>`/`Select` nativos.

---

## CMS (Conteudos.tsx)

O CMS tem quatro contextos: `website`, `product`, `service`, `gym`. O contexto infere-se pelo prefixo da chave (`product.`/`service.`/`gym.`) ou pela secção; `website` é o resto.

- **Secções**: hierarquia de organização (parent/child)
- **Entradas**: `key` + `locale` + `value` + `type` (text | richtext | image)
- Traduções agrupadas por `key`: `Record<locale, value>`
- A língua padrão define a coluna principal das tabelas

### Associar entradas CMS (nomes traduzíveis) — `CmsCombo`

Componente partilhado [`src/components/CmsCombo.tsx`](src/components/CmsCombo.tsx) usado para os **nomes** de **serviços** (Agenda), **produtos** (Loja) e **ginásio** (exercícios/treinos/planos/grupos). Comportamento:
- Campo de **texto livre** com **autocomplete** de entradas CMS existentes do mesmo contexto (`/cms/search?context=`) — clicar reutiliza a chave.
- **Não há botão "criar entrada"**: se escreveres um nome novo, a entrada é criada **ao Guardar** o formulário, via `ensureCmsName(contentKey, context, name, defaultLang)` ([`src/lib/gymCms.ts`](src/lib/gymCms.ts)) — gera `${context}.${uuid}` se não houver `contentKey` e grava o nome na língua padrão. Botão "Traduções" abre o `CmsTranslationsModal`.
- Controlado por `value` (contentKey) + `name` (texto); `onChange(key, name)`. As entidades guardam `contentKey` (+ `descriptionKey` em serviços/produtos); o nome resolve-se do CMS na leitura.

### Importar conteúdo via CSV

Para popular o CMS de um novo site de cliente, criar um `content-import.csv` e importar via `POST /api/cms/setup`.

**Formato — 6 colunas obrigatórias:**

```
key,locale,value,type,section,parent
```

| Coluna | Descrição |
|--------|-----------|
| `key` | Identificador único em dot-notation (`hero.title`, `project.slug.stat.1.value`) |
| `locale` | Código de língua: `pt`, `en`, `fr` |
| `value` | O conteúdo. **Nunca deixar vazio** — apagar a linha inteira se não há valor |
| `type` | Ver tabela abaixo |
| `section` | Nome da secção a que a entrada pertence |
| `parent` | Nome da secção pai; deixar vazio para secções raiz |

**Tipos de conteúdo:**

| Tipo | Quando usar |
|------|-------------|
| `text` | Títulos, labels, descrições, qualquer string |
| `richtext` | HTML inline simples (`<em>`, `<strong>`, `<br>`) |
| `number` | Valores numéricos (anos, contagens, áreas) |
| `data` | Slugs, referências internas, flags — não é texto traduzível |
| `url` | Links externos |
| `email` | Endereços de email |
| `phone` | Números de telefone |
| `file` | URL de ficheiro para download (PDF, etc.) |
| `image` | URL de imagem (OG images, fotos, etc.) |

**Regras:**

1. **Sem valores vazios** — a linha é ignorada se `value` estiver em branco. Apagar a linha em vez de deixar vazio.
2. **Slugs e referências** usam tipo `data` e só precisam de locale `pt`.
3. **URLs, ficheiros, OG images** — só precisam de locale `pt` (são neutros em termos de língua).
4. **Textos traduzíveis** devem ter uma linha por cada locale activo.
5. **Hierarquia de secções**: `section` + `parent` criam a árvore automaticamente — não é necessária uma ordem específica no ficheiro.

**Exemplo mínimo:**

```csv
key,locale,value,type,section,parent
hero.title,pt,Título em Português,text,Hero,Homepage
hero.title,en,Title in English,text,Hero,Homepage
hero.cta,pt,Saber mais,text,Hero,Homepage
contact.email,pt,geral@cliente.pt,email,Contactos,Homepage
seo.home.title,pt,Cliente — Slogan,text,SEO · Homepage,SEO
seo.home.og_image,pt,https://cliente.pt/assets/og.jpg,image,SEO · Homepage,SEO
```

O ficheiro `winterplateau/content-import.csv` é o exemplo de referência com um site completo (nav, hero, produtos, projetos com SEO, 3 línguas).

---

## Línguas

Configuradas em Admin → tab "Línguas":
- **Línguas activas**: grid com bandeiras reais (`country-flag-icons`), toggle por clique
- **Língua padrão**: pills com bandeiras entre as línguas activas, clique para seleccionar
- PT é a língua padrão para novos utilizadores (definido na API)
- Mapeamento língua→país em `src/utils/langFlag.tsx`

`TranslationInputs` usa `useGetSettingsLanguages()` para renderizar um campo por língua activa.

---

## Notificações em Tempo Real

- **SSE** (`useSSE.ts`): ligação persistente a `/api/events/stream`, recebe eventos `notification`
- **Web Push** (`usePushSubscription.ts`): subscrição via VAPID, funciona com o browser fechado
- **NotificationBell**: badge com contagem não lida + dropdown com lista + acções (marcar lida, eliminar). Renderiza por **taxonomia unificada** (`NOTIF_META`: label + cor por tipo) — fallback `system` para tipos desconhecidos. **Cada notificação é clicável** (a área de conteúdo é um botão, irmão dos ícones de ação): ao clicar **marca como lida + fecha o painel + navega** para o recurso (deep-link). O destino vem de **`src/lib/notificationTarget.ts`** (`notificationHref(n)`), que mapeia `type`+`data` → rota usando os parâmetros que cada página já lê: `booking/reminder`(data)→`/agenda?marcacao=|?data=` · `order`→`/loja?tab=encomendas` · `customer`(com `data.leadId`)→`/clientes?tab=leads&lead=` (novo lead — ver **Leads** em `Clientes.tsx`) · `customer`/`gym`(c/cliente)→`/clientes?cliente=` · `gym`(s/cliente)→`/ginasio` · `payment`/`reminder`(period)→`/financeiro?vista=ginasio` · `stock`→`/loja?openProduct=` · `system`/sem destino→`null` (clicar só marca lida; o título só fica com cor `accent` no hover quando há destino). A **Loja** lê `?tab=` (produtos/encomendas/categorias) para o deep-link de encomendas. Mapeamento testado em `tests/unit/notificationTarget.test.ts`.
- Criadas pela API via o helper único **`notifyUser()`** (`src/utils/notifyUser.ts` → DB + SSE + Web Push). **Taxonomia (a mesma em todo o lado):** `booking · order · customer · gym · payment · stock · reminder · message · system` (coluna `Notifications.type` = VARCHAR, migração `20260626120000`). Eventos ligados: novo booking/cancelamento público, nova encomenda, **novo cliente registado**, **nova mensagem de chat** (`message`, ver secção **Chat de Suporte**). **A ligar (consistência em curso):** stock baixo, mensalidade/pagamento, e **lembretes** (marcações + mensalidades em atraso) — estes precisam de um agendador (cron; ainda não existe na API)

---

## Chat de Suporte (Admin ↔ tenant)

Canal de mensagens **1:1** entre o **Admin da plataforma** (o dono, `VIEW_ADMIN`) e cada **tenant** (`User` do backoffice). **Não** envolve clientes finais nem sites públicos. Brief/tarefas em `.design/support-chat/`.

- **Onde se acede (para todos):** **3 entradas** — página própria **`/mensagens`** na sidebar (`Mensagens.tsx`, core) + **ícone no topbar** (`ChatLauncher`, navega p/ /mensagens) + **botão flutuante** no canto inferior direito (`ChatFab`) que **abre um mini-chat sobreposto** (`ChatPopup`, widget — não navega; some na página /mensagens). Todas mostram badge de não-lidas (`useChatUnread`: admin = nº conversas por ler; tenant = a sua). A vista decide pelo papel: **Admin** → inbox de todos os tenants (`MensagensTab` na página; lista→conversa no popup); **tenant** → a sua conversa única. Tudo partilha `ChatConversationView` (**nunca forkar a lógica**).
- **Decisões (brief):** ambos iniciam · texto **+ anexos de imagem** (`/api/uploads`, upload diferido) · **bolhas estilo messenger** · **"visto"** (derivado dos `*LastReadAt`). **Sem typing indicator** (cortado, v2).
- **Tempo real + avisos:** SSE evento `message` + evento **`chat_read`** (atualiza o "visto" sem refresh) — ambos invalidam `["chat"]` no `useSSE.ts`. Ao chegar `message` e **não** se estar em `/mensagens`, mostra-se um **toast** (`sonner`, coalescido por conversa, ação "Abrir" → /mensagens). **NÃO há notificação no sino** (decisão do user — o chat tem badges próprios). **Web Push (PWA) enviado SEMPRE**; o service worker (`public/sw.js`) só mostra a notificação do sistema se a app **não** estiver visível (`suppressWhenFocused` — quando está visível há toast/badge), e o clique navega **direto para /mensagens** (`notificationclick` → `data.url`). Testado em `tests/backoffice/chat_push.test.ts`.
- **API:** modelos `Conversation` (1 por tenant: `tenantUserId` único, `adminUnread`/`tenantUnread`, `*LastReadAt`) + `Message` (`senderRole` admin|tenant, `attachments` JSON). Rotas `/api/chat/support/*` (tenant — resolve sempre por `req.user`) e `/api/admin/chat/*` (`VIEW_ADMIN`). Helper `src/utils/chatNotify.ts` (`notifyNewMessage`/`getAdminUserIds`/`broadcastRead`). Schemas OpenAPI `Chat*` em `swaggerBackoffice.ts`.
- **Isolamento + segurança (auditado — veredicto HELD):** exceção **deliberada** (o Admin cruza tenants) — assimétrica: `/admin/chat/*` gated `VIEW_ADMIN`; `/chat/support/*` resolve pela `userId` autenticada → um tenant nunca vê a conversa de outro. `senderRole`/`senderUserId`/`conversationId` são **sempre server-side** (sem mass-assignment). **Anexos só `http(s)`** (allowlist na API `parseMessageInput` + no `MessageThread`, anti `javascript:`/`data:`). **Rate-limit por utilizador** no POST (`chatRateLimit`, isento em testes). Coberto em `tests/backoffice/chat_isolation.test.ts` (isolamento + 403/401 + mass-assignment + fuzzing `before` + anexos perigosos + truncagem). *(Nota: um admin pode abrir conversa com qualquer `User` existente — aceite como in-scope do papel Admin.)*
- **Permissões:** **nenhuma nova** — admin = `VIEW_ADMIN` (já existe), tenant = core (qualquer autenticado). "Quem é o admin a notificar" = **todos os utilizadores com acesso de Admin/VIEW_ADMIN** (`getAdminUserIds`).
- **Hooks/UI:** `src/hooks/useChat.ts` (tipos locais; sem Kubb), componentes em `src/components/chat/`. Testes unitários: `MessageThread.test.tsx`, `Composer.test.tsx`.

---

## Geração de Código (Kubb)

O spec OpenAPI `/api-docs/backoffice.json` é lido pelo Kubb e gera:
- `src/gen/backoffice/hooks/` — hooks React Query (useGet*, usePost*, etc.)
- `src/gen/backoffice/types/` — tipos TypeScript dos requests/responses

Os ficheiros em `src/gen/` não devem ser editados manualmente.

### OFFLINE por defeito (o `spec.json` committado é a fonte de verdade)

O `kubb.config.ts` gera **SEMPRE a partir do `spec.json` committado** (versionado no repo, `input.path`) — `pnpm kubb`/`dev`/`build` **não** dependem da API estar de pé nem esperam por um fetch. É determinístico (mesmo spec → mesmo `src/gen/`) e o CI não precisa da API.

- **Quando a API muda** (novo/alterado endpoint): `pnpm kubb:refresh` → busca o spec fresco da API, reescreve o `spec.json` e regenera. **Committar o `spec.json`** atualizado. (Alternativa sem API a correr: `pnpm exec ts-node --transpile-only scripts/dumpSpec.ts backoffice > ../Backoffice/spec.json` na API — serializa o spec da fonte, offline.)
- **`pnpm kubb`** (sem refresh) = offline; falha claro se faltar o `spec.json`.
- O `VITE_API_BASE_URL` continua **obrigatório** (é o `baseURL` dos hooks gerados) mas só precisa de estar **definido** (`.env.development`), não de a API estar **a correr**.
- `kubb.config.ts` é tooling Node **fora** do `tsconfig` da app (`include: ["src"]`) → `@ts-nocheck` no topo (o `@types/node` não entra na app de propósito).

### Fetch do spec atrás da Cloudflare (Bot Fight Mode) — só no `kubb:refresh`

Quando o `kubb:refresh` busca o spec e a API está atrás da Cloudflare com Bot Fight Mode ativo, o fetch é bloqueado como bot. Solução: enviar um header de bypass (os tokens `SWAGGER_ACCESS_TOKEN`/`CF_BYPASS_TOKEN` são **opcionais** e lidos SÓ no refresh).

- **Env (build-time):** `CF_BYPASS_TOKEN` — definir no build do Coolify. **NUNCA prefixar com `VITE_`** (senão o Vite inclui-o no bundle do browser). Só é enviado no header `X-CI-Bypass` do pedido ao spec; não fica em `spec.json` nem em `src/gen/`.
- **Cloudflare → WAF → Custom rule:** `Header X-CI-Bypass equals <segredo>` → action **Skip** Bot Fight Mode / Managed Challenge (opcionalmente restringir a `URI Path equals /api-docs/backoffice.json`).
- Em localhost (sem Cloudflare) o token não é necessário — o header só é enviado se `CF_BYPASS_TOKEN` existir, por isso o `pnpm kubb`/`pnpm dev` local funciona na mesma.

---

## Autenticação

`AuthContext.tsx` gere:
- Login com `POST /users/login` → armazena `accessToken` em memória
- Refresh automático com `POST /users/refresh` (cookie httpOnly)
- CSRF token lido de `/csrf-token` e enviado em headers `x-csrf-token`
- `authHeader()` devolve `{ Authorization: "Bearer ..." }` para usar nos hooks
- `isAuthenticated` + `user` disponíveis em toda a app

---

## Segurança e Boas Práticas

- Nunca expor `userId` ou dados de outros tenants nas queries
- Sempre usar `authHeader()` nos hooks manuais
- O Kubb injeta automaticamente o header nos hooks gerados via o cliente axios configurado
- Uploads de imagem/vídeo via `/api/uploads` (nunca base64 em JSON)
- **Upload diferido**: ficheiros escolhidos são segurados localmente (preview `blob:`) e só enviados quando o user clica em **Guardar** — nunca no momento de escolher. Evita ficheiros órfãos no storage se o formulário for cancelado. Aplica-se a: Ginásio (`MediaGallery` + `uploadPendingMedia`), Loja (foto do produto) e Conteúdos/CMS (imagens das entradas)
