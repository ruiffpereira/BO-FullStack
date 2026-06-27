# Design Brief: Financeiro (redesign)

> Plataforma SaaS multi-tenant. Frontend: `Backoffice` (Vite + React + TS + Tailwind).
> Backend: `API-FullStack` (Express + TS). Este redesign é **full-stack**: o ecrã vive no
> Backoffice, mas depende de dados/endpoints novos na API. Tarefas marcadas `[BO]` / `[API]`.

## Problem

O dono do negócio abre o Financeiro para responder a duas perguntas: **"estou a ganhar dinheiro?"**
e **"o meu negócio está saudável ou a definhar?"**. Hoje não consegue responder bem a nenhuma:

- O ecrã **"O Negócio"** esmaga agenda + loja + ginásio num único agregado. Não há forma de ver
  o financeiro **de cada negócio** em separado, apesar de cada um ter uma economia diferente
  (uma marcação não é uma encomenda não é uma mensalidade).
- O número **"Ticket médio"** mistura encomendas com marcações concluídas (`revenue / txCount`) —
  é jargão e não significa nada para o dono.
- A **loja não mostra lucro real**: não há custo de mercadoria (COGS), por isso "lucro" é só
  receita − despesas globais. Pior: a receita da loja **conta encomendas canceladas e reembolsadas**
  (bug) e ignora o fim do período.
- Falta o eixo **qualidade**: na agenda e na loja não há clientes perdidos, recorrência nem LTV.
  Só o ginásio tem churn/retenção/LTV.
- O dono não distingue **faturado** (o que vendeu) de **recebido** (o que entrou em caixa) de
  **em dívida** (o que falta cobrar) — exceto no ginásio.

## Solution

Um Financeiro **dividido por negócio**, em que cada vertical (Agenda, Loja, Ginásio) tem o seu
próprio mini-dashboard financeiro profundo, e uma vista **"O Negócio"** que consolida tudo conforme
as permissões do tenant. Cada vertical responde, na sua própria linguagem, às duas perguntas:
**quanto dinheiro** (faturado / recebido / em dívida / despesas / lucro) e **que qualidade**
(clientes novos / perdidos / recorrentes / retenção / valor médio). Por cima, um **Score de saúde
do negócio** traduz a "qualidade" num só olhar.

O ginásio — já o mais maduro — ganha uma operação de cobrança melhor: **gerar as mensalidades do mês
automaticamente**, **cobrar em massa**, uma **vista de clientes** mais rica e **avisos de quem está
em atraso**.

## Experience Principles

1. **Cada negócio na sua língua, não um molde único** — uma marcação, uma compra e uma mensalidade
   têm economias diferentes. Os KPIs, gráficos e nomes adaptam-se a cada vertical em vez de forçar
   um vocabulário comum confuso ("ticket médio").
2. **Dinheiro honesto antes de dinheiro bonito** — preferimos um número certo (receita líquida sem
   cancelados, lucro com custo real) a um número grande e falso. Faturado, recebido e em dívida são
   sempre distinguíveis; nunca se esconde o que falta cobrar.
3. **Da métrica à ação** — cada sinal de alerta (em atraso, cliente a fugir, stock parado, margem
   negativa) vem com o caminho para agir (cobrar, contactar, repor), não fica só bonito num gráfico.

## Aesthetic Direction

- **Philosophy**: *Calm financial dashboard* — denso em dados mas sereno. Cartões claros,
  hierarquia tipográfica forte, números em `tabular-nums`, cor usada com parcimónia e sempre
  semântica. Inspiração: Stripe Dashboard, Linear Insights, Lemon Squeezy.
- **Tone**: confiante, sóbrio, "private banking" — não festivo, não "growth-hacky".
- **Reference points**: Stripe (cartões de KPI + séries), Linear (densidade calma, dark mode),
  Lemon Squeezy (clareza de receita).
- **Anti-references**: dashboards "NASA" com 20 widgets a competir; gradientes garridos;
  gráficos 3D; cor a decorar em vez de a significar.

## Existing Patterns (reutilizar, não substituir)

- **Typography**: `Hanken Grotesk` (carregada em `index.css`). Títulos semibold, números
  `tabular-nums tracking-tight`. Manter.
- **Colors**: accent `#2A6FDB` (`--accent`, classe `bg-accent`/`text-accent`). Semântica de cor
  **já estabelecida e a respeitar**: `emerald` = receita/pago, `red` = despesa/atraso,
  `amber` = dívida, `blue` = lucro, `violet` = clientes. Dark mode via paleta `zinc` + `dark:`.
- **Spacing**: escala Tailwind; cartões `p-5`, grelhas `gap-4`, `space-y-4/6`. Manter.
- **Components** (`src/ui/ui.jsx`): `Card, Button, IconButton, Badge, Input, Select, Toggle,
  Modal, EmptyState, Avatar, PageHeader, SectionTitle, Tabs, BADGE_TONES`. `Icon` (`ui/icons.jsx`).
  Charts caseiros em `ui/charts.jsx` (`LineChart`).
- **Dados**: hooks **gerados pelo Kubb** a partir do OpenAPI da API. Endpoints novos ⇒ `pnpm kubb`.
- **Formatação**: `Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' })`; datas/períodos
  em PT (`Jan…Dez`). Reutilizar os helpers de `GymMensalidade.tsx`.

### Decisão sobre gráficos
**Misto.** Manter os caseiros (sparklines, barras, progress, heatmaps) e **introduzir `recharts`**
para os ricos (donut de distribuição de receita, **MRR/receita waterfall**, área receita/despesa/lucro,
cohort de recompra). `recharts` estilizado com os tokens existentes (accent + zinc + semântica).
Justificação: "profundo (tudo)" com qualidade de apresentação top sem reescrever charts complexos
em `div`s. *(Decisão minha por delegação — vetável.)*

## Component Inventory

| Component | Status | Notes |
| --------- | ------ | ----- |
| `FinanceiroPage` (tabs) | Modify | Tabs passam a: **O Negócio · Agenda · Loja · Ginásio · Despesas**, cada uma gated por permissão (`VIEW_SCHEDULE`/`VIEW_PRODUCTS`/`VIEW_GYM`). Default = O Negócio; se só houver 1 vertical, abre nesse. |
| `ONegocio` (consolidado) | New (substitui `Financeiro.tsx`) | Roll-up: KPIs totais (faturado/recebido/em dívida/despesas/lucro), distribuição de receita por fonte (donut), série receita/despesa/lucro (área), **Score de saúde**, top global. |
| `FinanceiroAgenda` | New | Mini-dashboard da agenda. |
| `FinanceiroLoja` | New | Mini-dashboard da loja (com margem/COGS). |
| `FinanceiroGinasio` | Modify (`GymMensalidade.tsx`) | Reaproveita Cobranças/Subscrições/Análise; acrescenta gerar-mês + cobrança em massa + vista de clientes + avisos. |
| `Despesas` | Keep | Mantém-se; passa a alimentar o lucro de cada vertical. |
| `KpiCard` | Modify/Unify | Um único cartão de KPI com: valor, label, delta vs período anterior, sub-linha, tom semântico, estado loading. Hoje há 2 variantes (`Kpi` em Financeiro, `KpiCard` em GymMensalidade) → consolidar num só. |
| `MoneyTriad` | New | Bloco "Faturado / Recebido / Em dívida" reutilizável por vertical. |
| `HealthScore` | New | Medidor composto (gauge/anel) com breakdown ao hover/expand. |
| `DonutChart` | New (recharts) | Distribuição de receita por fonte / por categoria. |
| `WaterfallChart` | New (recharts) | MRR/receita: novo + expansão − contração − churn. |
| `AreaTrend` | New (recharts) | Receita vs despesa vs lucro no tempo. |
| `CohortGrid` | New | Recompra/retenção por cohort (heatmap caseiro). |
| `HeatmapDiaHora` | New | Agenda: ocupação dia × hora (heatmap caseiro). |
| `LostCustomersList` | New | Clientes "a fugir" (sem atividade há N dias) + ação contactar. |
| `BulkChargeBar` | New | Ginásio: selecionar vários + marcar pagos / enviar lembrete. |
| `VatField` / toggle c-IVA | New | Campo de IVA por item + alternador com/sem IVA nas vistas. |
| `PeriodPicker` | Reuse | Presets (Hoje/Semana/Mês/Último mês/Ano) + `DateRangePicker` (já existe). |

## Key Interactions

- **Trocar de vertical**: tabs no topo; o conteúdo abaixo troca sem recarregar a página. A tab só
  aparece se o tenant tiver a permissão. Estado do período é partilhado entre tabs.
- **Faturado ↔ Recebido**: em cada vertical, a tríade mostra os três valores; um toggle **c/IVA · s/IVA**
  alterna a base de cálculo dos montantes apresentados.
- **Score de saúde**: anel com número 0–100; ao expandir, mostra os fatores (crescimento de receita,
  retenção, % em dívida, valor médio) e quanto cada um pesa.
- **Cobrança em massa (ginásio)**: checkbox por linha → barra de ação fixa ("3 selecionados ·
  Marcar pagos · Enviar lembrete"). "Gerar mês" cria as mensalidades em falta do período num clique.
- **Cliente perdido → ação**: lista de quem não aparece há N dias com botão para contactar
  (email/notificação) ou ver ficha.
- **Drill-down**: clicar num top-serviço/produto/aluno abre detalhe; clicar num ponto do gráfico
  filtra o período.
- **Feedback**: toasts (`sonner`) em todas as mutações; skeletons em loading; empty states com ação.

## Responsive Behavior

- **Desktop (≥1024px)**: grelha de KPIs 3–5 colunas; gráficos lado a lado; tabelas completas.
- **Tablet (768px)**: KPIs 2–3 colunas; gráficos empilham; tabelas escondem colunas secundárias
  (padrão `hidden md:table-cell` já usado).
- **Mobile (375px)**: KPIs 2 colunas; tudo empilha; tabelas viram listas/cartões (o padrão `dense`
  do `ClienteMensalidade` já faz isto); tabs com scroll horizontal; barra de cobrança em massa
  fixa no fundo. Alvos de toque ≥44px. Sem scroll horizontal na página.

## Accessibility Requirements

- Contraste AA: texto ≥4.5:1, números grandes ≥3:1 — validar a semântica de cor em dark mode.
- A cor **nunca é o único sinal**: estados (pago/dívida/atraso) sempre com ícone + label além da cor.
- Navegação por teclado em tabs, toggles, seleção em massa e modais; focus rings visíveis
  (`focus:ring-accent/20` já em uso).
- Gráficos com alternativa textual/tabela acessível e `aria-label`; decorativos `aria-hidden`.
- `prefers-reduced-motion` respeitado nas transições/contadores animados.

## Out of Scope

- **Faturação certificada / faturas legais** (séries, ATCUD, SAF-T) — fica para o fim do roadmap.
  Capturamos a taxa de IVA por item e mostramos com/sem IVA, mas **não emitimos faturas**.
- **Cobrança automática real** (débitos/Stripe/MBWay) — o ginásio regista pagamentos manualmente;
  "lembretes" são notificações, não cobrança automática.
- **Multi-moeda** — só EUR.
- **Exportação contabilística avançada** (SAF-T) — fora; um export simples (xlsx) pode entrar nas tasks.
- **Mudanças no PWA do cliente** (gymnoprado) além de respeitar `blocked` — fora.
```