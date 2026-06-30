# Design Brief: Dashboard vertical-aware

## Problem

Cada tenant abre a plataforma na mesma página inicial (`/`), mas o negócio de cada um é diferente — um barbeiro vive de marcações à hora, um ginásio vive de mensalidades recorrentes, uma loja vive de encomendas a despachar. Hoje o Dashboard assume que **toda a gente é um negócio de marcações**: a peça central é a timeline de marcações do dia, os KPIs lideram com a agenda, e o `VIEW_GYM` nem sequer é lido no código. Resultado:

- **Dono de ginásio** abre a app e a primeira página não lhe diz **nada** do negócio dele — nem quanto falta cobrar este mês, nem quem está em atraso, nem quantos sócios ativos. Vê um dashboard praticamente vazio.
- **Dono de loja** vê só uma contagem total de encomendas (de sempre) e uma lista de 6 — não responde às perguntas do dia: *o que despacho hoje? quanto vendi hoje? o que está a acabar?*
- **"Receita de hoje"** só conta marcações pagas; receita de loja e de mensalidades não aparece.
- Quem tem **várias permissões** perde KPIs ao calhas (o `.slice(0,4)` corta logo as "Encomendas").

A frustração humana: *"esta página não fala do meu negócio."*

## Solution

Um Dashboard que se **compõe a partir do negócio do tenant**, lendo as permissões (`VIEW_SCHEDULE`, `VIEW_PRODUCTS`, `VIEW_GYM` + core de clientes) e montando a página com o que é operacionalmente relevante para *aquele* tenant — incluindo combinações. A mesma gramática visual (faixa de KPIs → espinha → carris de apoio), mas o **conteúdo** muda:

- A **espinha** (a peça central) é a coisa mais sensível ao tempo que o tenant tem de fazer agora: marcações de hoje (agenda) · cobranças do mês com quem está em atraso (ginásio) · encomendas por despachar (loja).
- Os **KPIs** são escolhidos por relevância e equilíbrio entre verticais (uma métrica-âncora por vertical ativa), com uma **"Receita de hoje" agregada** (soma real de agenda + loja + ginásio), nunca cortando arbitrariamente.
- Os **carris de apoio** dão o panorama das outras verticais ativas (mini-cartão de cobranças do gym, últimas encomendas + stock baixo, estado das marcações do mês).
- Cada número é **clicável** e leva ao sítio onde se age (reaproveita o padrão de deep-link já criado: `/financeiro?vista=ginasio`, `/loja?tab=encomendas`, `/agenda`, `/clientes?cliente=`).

Tudo alimentado por endpoints que **já existem** — `GET /api/dashboard?period=today` (agrega schedule+ecommerce+gym+expenses) e `GET /gym/mensalidade/finance?period=<mês>` (recebido/em dívida/em atraso/MRR). Sem novos endpoints obrigatórios.

## Experience Principles

1. **O negócio do tenant manda o layout** — A página compõe-se a partir das permissões. Um ginásio nunca vê uma espinha de marcações vazia; uma loja nunca lidera com "marcações hoje". Nada de blocos irrelevantes "porque o componente existe".
2. **Hoje opera, o mês orienta** — A espinha e os KPIs respondem a *"o que faço agora?"* (hoje/agora). Onde o ciclo é mensal por natureza (mensalidades), mostra-se o mês — mas sempre com a ação à frente (quem está em atraso), não só o número.
3. **Cada número é uma porta** — Nenhuma métrica é decorativa nem de vaidade. Toda a KPI/linha leva, a um clique, ao ecrã onde se resolve. Preferir métricas acionáveis (por cobrar, por despachar, stock baixo) a contagens totais estáticas.

## Aesthetic Direction

- **Philosophy**: Dieter Rams / funcionalista — o que já existe no admin. Menos, mas melhor: cada elemento ganha o seu lugar.
- **Tone**: Calmo, operacional, de confiança. Um "centro de comando" sereno, não um painel de aeroporto.
- **Reference points**: Linear (densidade calma + tipografia precisa), o cockpit de Cobranças que já existe (`.design/gym-cobrancas`), Stripe Dashboard (KPI band + acionável).
- **Anti-references**: Dashboards de vaidade cheios de gauges e donuts coloridos; gradientes roxos; números grandes sem ação; "analytics" (isso é a página Estatísticas/Financeiro, não o Dashboard).

## Existing Patterns

- **Typography**: Tailwind default sans + `font-mono tabular-nums` para horas/números. Títulos `tracking-tight`, eyebrows `text-xs uppercase tracking-wide` (`SectionTitle`).
- **Colors**: zinc neutros + um único `accent` (`rgb(var(--accent))`); tons semânticos via `BADGE_TONES` (blue/green/violet/amber/red). Dark mode por `dark:`.
- **Spacing**: escala 4/8px; cartões `Card` com `p-4`/`p-5`, grelhas `gap-3`/`gap-4`.
- **Components**: `Card`, `Badge`, `EmptyState`, `SectionTitle`, `Icon` (`ui/icons.jsx`), `KpiCard` + `DayRail` + `NowMarker` (locais no `Dashboard.tsx`), gráficos `Sparkline`/`LineChart`/`DonutChart`/`BarChart` (`ui/charts.jsx`), `useDashboard` (`hooks/useDashboard.ts`).

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `KpiCard` | Modify | Tornar clicável (deep-link `href` opcional, cor `accent` no hover quando navegável) + suportar valor `€`/contagem/delta+sparkline. Extrair para `components/` (reutilizável). |
| Seleção de KPIs | New (lógica) | Escolher KPIs por vertical ativa + "Receita de hoje" agregada; equilíbrio em vez de `slice(0,4)`. |
| `DayRail` | Exists / keep | Espinha da **agenda** (timeline de hoje + próximo + "agora"). Sem alterações de fundo. |
| `GymCobrancasBlock` | New | Espinha do **ginásio** quando não há agenda: progresso *Recebido €X / €Y previsto*, Por cobrar/Em atraso/MRR, e lista curta de **em atraso** (clicável → ficha). Reusa números de `/gym/mensalidade/finance`. |
| `GymMiniCard` | New | Versão de carril (quando o gym não é a espinha): Recebido/previsto + badge "N em atraso" → `/financeiro?vista=ginasio`. |
| `FulfillmentBlock` | New/Modify | Espinha/bloco da **loja**: "Por despachar" (encomendas pendentes), Vendas de hoje, e últimas encomendas (evolui o `recentOrders` atual). |
| `StockAlertsCard` | New | Carris: produtos com stock baixo (de `ecommerce.stockAlerts`) → `/loja?openProduct=`. |
| `StatusBreakdown` | Exists / keep | Estado das marcações do mês (carril, só agenda). |
| `Sparkline`/`LineChart`/`DonutChart` | Exists | Tendências (14d marcações, receita). Usar com parcimónia. |
| `EmptyState` | Exists | Estados vazios por bloco (dia livre / sem subscrições / sem encomendas / sem stock baixo). |
| `useGymFinance` | New (hook fino) | `GET /gym/mensalidade/finance?period=<mês>` → `{ recebido, emDivida, emAtraso, mrr, blocked }`. (Alternativa: dobrar estes campos no bloco `gym` do `/api/dashboard` — fica out-of-scope v1.) |

## Composition Model (o coração do brief)

**Layout-base (mantém-se):** Header (dia/data/hora viva + saudação) → **faixa de KPIs** (2 cols mobile / 4 desktop) → grelha principal `lg:grid-cols-12`: **espinha** (`lg:col-span-7`) + **carril** (`lg:col-span-5`). Sem agenda, a espinha cede o lugar e o conteúdo principal ocupa mais largura.

**1. Escolha da ESPINHA (a peça central, por prioridade operacional):**
- tem `VIEW_SCHEDULE` → **"Hoje"** (`DayRail`, marcações do dia). _É a vertical mais sensível à hora; ganha sempre a espinha._
- senão tem `VIEW_GYM` → **"Cobranças de {mês}"** (`GymCobrancasBlock`).
- senão tem `VIEW_PRODUCTS` → **"Por despachar + Vendas de hoje"** (`FulfillmentBlock`).
- senão (só core) → **"Os teus clientes"**: total + novos esta semana + atalhos (Clientes, Conteúdos). Nunca o atual erro "Sem permissões activas".

**2. Faixa de KPIs (até 4, escolhidos por relevância, sem corte arbitrário):**
- Slot 1 — **Receita de hoje** (agregada): soma do `revenue` de hoje das verticais ativas (`schedule + ecommerce + gym` via `useDashboard('today')`). Só aparece se houver ≥1 vertical de receita.
- Depois, **uma âncora por vertical ativa**, nesta ordem até encher 4:
  - agenda → **Marcações hoje** (sub: "N por confirmar").
  - ginásio → **Por cobrar** (€ `emDivida`) _ou_ **Em atraso** (N) se houver atrasos (o atraso tem prioridade visual, tom `red`).
  - loja → **Por despachar** (N encomendas pendentes) _ou_ **Vendas hoje** (€) se nada pendente.
  - clientes (core) → **Clientes novos** (N esta semana, com delta) — preenche slot livre; preferir a contagens totais.
- Cada KPI é clicável para a sua página.

**3. Carril de apoio (as OUTRAS verticais ativas, empilhadas):**
- agenda presente → `StatusBreakdown` do mês.
- gym presente **e não é a espinha** → `GymMiniCard`.
- loja presente **e não é a espinha** → `FulfillmentBlock` (últimas encomendas) + `StockAlertsCard` se houver alertas.

**Exemplos de composição (validação mental):**
- _Barbeiro (agenda)_: espinha = Hoje; KPIs = [Receita hoje][Marcações hoje][14 dias][Clientes novos]; carril = estado do mês. _(≈ o atual, melhorado.)_
- _Ginásio puro (gym + core)_: espinha = Cobranças do mês + em atraso; KPIs = [Receita hoje][Por cobrar][Em atraso][Sócios ativos]; carril = clientes novos. _(Hoje vê vazio → passa a ver o negócio.)_
- _Loja pura (loja + core)_: espinha = Por despachar + Vendas hoje; KPIs = [Receita hoje][Por despachar][Ticket médio][Clientes novos]; carril = últimas encomendas + stock baixo.
- _Misto (agenda + loja + gym)_: espinha = Hoje (agenda); KPIs = [Receita hoje agregada][Marcações hoje][Por despachar][Em atraso/Por cobrar]; carril = mini-gym + últimas encomendas + stock + estado do mês. _Sem cortar a loja como hoje._

## Key Interactions

- **Clicar numa KPI ou linha** → navega para o ecrã de ação (deep-links já suportados: `/agenda`, `/financeiro?vista=ginasio`, `/loja?tab=encomendas`, `/loja?openProduct=<id>`, `/clientes?cliente=<id>`). Mesma afordância da feature de notificações: `cursor-pointer` + realce `accent` no hover quando navegável.
- **Espinha agenda**: banner "Próximo · em N min" + marcador "agora" pulsante que segue o relógio (tick a cada minuto). _(mantém-se.)_
- **Cobranças (gym)**: barra de progresso Recebido/previsto anima ao carregar; clicar num membro em atraso → ficha do cliente (tab Ginásio).
- **Loja**: "Por despachar" pisca tom `amber` se > 0; clicar → encomendas filtradas.
- **Estados de carregamento**: skeletons `animate-pulse` por bloco (já é o padrão).
- **Estados vazios**: cada bloco tem o seu `EmptyState` com convite ("Quando entrarem reservas…", "Cria a primeira subscrição…").

## Responsive Behavior

- **Mobile (<640):** coluna única. Header empilha (dia/hora em cima, saudação por baixo). KPIs em grelha 2×N. Espinha primeiro, depois carris empilhados. Alvos de toque ≥44px (KPIs e linhas clicáveis são cartões/linhas inteiras).
- **≥1024 (lg):** grelha 12 colunas — espinha 7 / carril 5. Sem agenda, o conteúdo principal usa 12 e o carril passa a grelha de cartões lado a lado.
- **Mudança de comportamento (não só tamanho):** a `DayRail` mantém o rail vertical em todos os tamanhos; o `GymCobrancasBlock` passa a lista (mobile) ↔ pode usar 2 colunas (desktop) para a lista de em atraso.

## Accessibility Requirements

- Contraste ≥ 4.5:1 para texto; o `accent` sobre fundo claro/escuro já cumpre nos usos atuais — validar nos números a verde/vermelho (usar os tons `emerald-600/red-500` já aprovados).
- KPIs/linhas clicáveis são `<button>`/`<a>` reais com `aria-label` descritivo ("Abrir agenda — 4 marcações hoje"), navegáveis por teclado, com foco visível.
- O marcador "agora" e barras de progresso respeitam `motion-reduce` (já usado no `NowMarker`).
- Cor nunca é o único sinal: "em atraso" tem rótulo + número, não só vermelho.

## Data Sources

- `useDashboard('today')` — receita por vertical (hoje), encomendas, `ecommerce.stockAlerts`, `ecommerce.customers.new`, `gym.activeMembers`, `schedule.byStatus`. _(Agregados.)_
- `useGetScheduleAppointments({ month })` — **lista** de marcações para a `DayRail` (o agregado não traz a lista). _(mantém-se.)_
- `useGetOrders()` — últimas encomendas + "por despachar" (filtrar estado pendente em todo o histórico, não só hoje). _(mantém-se.)_
- `useGymFinance(month)` — `recebido/emDivida/emAtraso/mrr` para a espinha/mini de cobranças. _(hook novo fino sobre `/gym/mensalidade/finance`.)_

## Out of Scope

- **Novos endpoints na API.** Reutiliza-se o que existe. (Folding de `emDivida/emAtraso` no `/api/dashboard` é uma otimização futura, não v1.)
- **Dashboard configurável** (arrastar/reordenar widgets, escolher métricas) — fica para v2.
- **Seletor de período no Dashboard** — mantém-se fixo (hoje + mês corrente). Análise por período é o **Financeiro/Estatísticas**, não o Dashboard.
- **Lista de em atraso do gym com ações inline** (marcar pago) — isso é o cockpit de Cobranças; aqui só leva-se lá.
- **Rever o sistema de permissões.** Nota: a página Clientes é *core* mas o Dashboard gateia dados de cliente em `VIEW_CUSTOMERS` — tratar clientes como core no Dashboard, sem mexer no RBAC.
