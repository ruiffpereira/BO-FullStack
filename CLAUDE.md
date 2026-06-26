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

A API deve estar a correr em `VITE_API_BASE_URL` (default: `http://localhost:3001/api`).

---

## Testes

Duas camadas, ambas em `tests/`:

- **Componentes (`tests/unit/`, Vitest + React Testing Library + jsdom):** testes unitários e isolados dos componentes partilhados — sem servidor nem API. Config em `vitest.config.ts`, setup em `tests/unit/setup.ts` (stub do `scrollIntoView`, matchers `jest-dom`). Hooks gerados (Kubb) que tocam a API são mockados (`vi.mock`). Cobertos: **Combobox, ConfirmDialog, DatePicker, DateRangePicker, FileUpload** (24 testes). Correr: `pnpm test:unit`.
- **End-to-end (`tests/e2e/`, Playwright):** fluxos reais no browser (Chromium). Correr: **`pnpm test:e2e`** — não precisa de nada ligado à mão (~87 testes, serial). Specs: admin, **admin-tokens**, agenda, **agenda-pagamentos**, **auth-setup-password**, auth, clientes, conteudos, **conteudos-multilingua**, dashboard, despesas, errors, financeiro, ginasio, **ginasio-detalhe**, loja, **loja-encomendas**, **notificacoes**, **rbac** (matriz de permissões), **isolamento** (multi-tenant, incl. deep-link), security. Page objects em `tests/e2e/pages/`; helper `fixtures/login.ts` (`loginAs`) para autenticar tenants específicos.

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
| `Admin.tsx` | `/admin` | `VIEW_ADMIN` | Utilizadores, permissões, componentes RBAC, site tokens, línguas, **Atividade** (audit log unificado — ações + erros 5xx, com filtro "Só erros") e **Sistema** (health) |
| `Agenda.tsx` | `/agenda` | `VIEW_SCHEDULE` | Calendário de agendamentos, serviços, horários, bloqueios |
| `Clientes.tsx` | `/clientes` | **core** (todos) | Lista de clientes; ficha com **tabs por permissão** (cabeçalho fixo + tab **Agenda** se `VIEW_SCHEDULE` = stats/histórico, tab **Ginásio** se `VIEW_GYM` = mensalidade do cliente via `ClienteMensalidade`) |
| `Conteudos.tsx` | `/conteudos` | **core** (todos) | CMS multi-língua: secções, entradas, textos, imagens |
| `Dashboard.tsx` | `/` | qualquer | Resumo operacional (marcações de hoje, últimas marcações/encomendas) |
| `FinanceiroPage.tsx` | `/financeiro` | **core** (todos) | Página "Financeiro" com tabs **O Negócio** (`Financeiro.tsx` — dashboard que agrega agenda/loja/**ginásio**+despesas) e **Despesas** (`Despesas.tsx`). `/despesas` é deep-link que abre a tab Despesas (não está na sidebar) |
| `Ginasio.tsx` | `/ginasio` | `VIEW_GYM` | Ginásio: exercícios, treinos, planos, programas/progresso por cliente e **Mensalidades** (tab; `MensalidadesTab` de `GymMensalidade.tsx`) (`/api/gym`) |
| `Loja.tsx` | `/loja` | `VIEW_PRODUCTS` | Produtos, categorias, subcategorias, encomendas, cupões |

A navegação em `Shell.tsx` é gerada a partir de duas famílias (overhaul 2026-06-25):
- **Core (todos os tenants, sem permissão):** Dashboard · **Clientes** · **Financeiro** (Negócio + Despesas) · **Conteúdos**. No backend, `/customers`, `/expenses`, `/cms` e `/dashboard` só exigem `authenticateToken` (dados scoped por `userId`).
- **Módulos (por permissão, em `MODULE_PERM_TO_PATH`):** Agenda (`VIEW_SCHEDULE`) · Loja (`VIEW_PRODUCTS`) · Ginásio (`VIEW_GYM`). **Admin** (`VIEW_ADMIN`) à parte.
- `/despesas` continua a funcionar como **deep-link** (abre o Financeiro na tab Despesas) mas **não** aparece na sidebar; o guard de rotas usa `allowedPaths = accessiblePaths + /despesas`.

---

## Componentes Partilhados

| Componente | Descrição |
|------------|-----------|
| `Shell.tsx` | Layout principal: sidebar, topbar, notification bell |
| `Login.tsx` | Formulário de login (standalone, sem Shell) |
| `NotificationBell.tsx` | Ícone com badge + dropdown de notificações em tempo real |
| `ApptModal.tsx` | Modal de criação/edição de agendamentos (usado em Agenda) |
| `FileUpload.tsx` | Upload de imagem único para SeaweedFS via `/api/uploads` (atualmente sem uso) |
| `MediaGallery.tsx` | Galeria de imagens/vídeos (Ginásio). **Upload diferido**: segura os ficheiros localmente (preview `blob:`) e só os envia ao Guardar, via `uploadPendingMedia()` |
| `Combobox.tsx` | Dropdown custom com pesquisa. Menu renderizado em **portal** (`document.body`, posição fixa) para não ser cortado por overflow de modais. `ref` aponta para o botão; tem `label`/`disabled` |
| `DateRangePicker.tsx` | Selector de intervalo de datas (`react-day-picker`, modo range, locale PT). Usado ao atribuir um programa |
| `TranslationInputs.tsx` | Campos de tradução por língua com bandeiras reais |

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
- **Mensalidades (2026-06-25):** é uma **tab dentro do Ginásio** (`Ginasio.tsx` → Mensalidades, `VIEW_GYM`). A receita das mensalidades **pagas** entra no `/api/dashboard` (bloco `gym`) e é agregada na tab **O Negócio** do Financeiro. A UI vive em `src/pages/GymMensalidade.tsx` (`MensalidadesTab`) com sub-tabs: *Mensalidades* (KPIs `recebido/em dívida/em atraso/MRR/bloqueados` + tabela de todos os clientes, clicar abre o detalhe) e *Subscrições* (catálogo CRUD: nome, preço, dia de vencimento, ativa). Modelo na API: `GymSubscription` (catálogo) → `GymMembership` (cliente↔subscrição + `blocked`) → `GymPayment` (registo mensal: `period`, `amount`, `dueDate` editável, `status` **paid|debt|unpaid**, `paidAmount`/`debtSince` para dívida parcial; "Em atraso" é derivado, não persistido). Geração **manual**. O componente partilhado **`ClienteMensalidade`** (exportado de `GymMensalidade.tsx`) é usado aqui (detalhe) e na **ficha do cliente** (tab Ginásio). Tokens EN no modelo, PT na UI. Endpoints: `/gym/subscriptions`, `/gym/mensalidade/*`.
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
- **NotificationBell**: badge com contagem não lida + dropdown com lista + acções (marcar lida, eliminar)
- Criadas automaticamente pela API em eventos chave (ex: novo agendamento público)

---

## Geração de Código (Kubb)

O spec OpenAPI `/api-docs/backoffice.json` é lido pelo Kubb e gera:
- `src/gen/backoffice/hooks/` — hooks React Query (useGet*, usePost*, etc.)
- `src/gen/backoffice/types/` — tipos TypeScript dos requests/responses

**Sempre que a API adiciona/modifica endpoints, correr `pnpm kubb`.**

Os ficheiros em `src/gen/` não devem ser editados manualmente.

### Fetch do spec atrás da Cloudflare (Bot Fight Mode)

O `kubb.config.ts` faz **pré-fetch** do spec via `fetch` (em Node, build-time) e escreve `spec.json` (gitignored); o Kubb lê esse ficheiro em vez de ir buscar o URL diretamente (suporte a headers custom no input do Kubb é limitado).

Quando a API está atrás da Cloudflare com Bot Fight Mode ativo, o fetch da build é bloqueado como bot. Solução: enviar um header de bypass.

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
