# Build Tasks: Financeiro (redesign)

Generated from: .design/financeiro/DESIGN_BRIEF.md + INFORMATION_ARCHITECTURE.md
Date: 2026-06-27

Legenda: **[API]** = `API-FullStack` · **[BO]** = `Backoffice`. Após mudar specs da API correr `pnpm kubb` no BO.
Philosophy a estabelecer no 1º slice visual: **calm financial dashboard** (Stripe/Linear/Lemon Squeezy).

## Foundation (primeiro — desbloqueia dados certos + direção estética)
- [x] **[API] Corrigir receita da Loja**: excluir `cancelled`/`refunded` e respeitar `endDate` em `ecommerceStats`. Define receita **líquida**. _Bug; barato; alto impacto._ — _Feito (`/financeiro/loja` devolve faturado líquido)._
- [x] **[API] Custo (COGS)**: campo `cost` em `Product` + snapshot `costAtPurchase` em `OrderProduct` (gravado no checkout) + migração. Base da margem real. _New field._ — _Feito (migração `20260627100000-add-product-cost-cogs.js`)._
- [x] **[API] IVA por item**: `vatRate` (nullable) em `Product`, `Service`, `GymSubscription` + migração; helper para aplicar/remover IVA. _New field._ — _Feito (migração `20260627110000-add-vat-rate.js`)._
- [x] **[API] Helpers de dinheiro partilhados**: funções `faturado`/`recebido`/`emDivida` consistentes reutilizadas por todos os verticais (competência vs caixa). _Refactor dashboard controller._ — _Feito (tríade Faturado/Recebido/Em dívida em todos os verticais)._
- [x] **[BO] Shell do Financeiro**: `FinanceiroPage` com tabs **O Negócio·Agenda·Loja·Ginásio·Despesas** gated por permissão, estado na URL (`?vista=`), **PeriodPicker + toggle c/IVA·s/IVA partilhados** no cabeçalho. _Modifica `FinanceiroPage.tsx`; reusa `Tabs`, `DateRangePicker`._ — _Feito (5 tabs gated + `?vista=` + PeriodPicker + `VatToggle`, este só em Agenda/Loja)._
- [x] **[BO] Kit visual partilhado**: `KpiCard` **unificado** (funde os 2 existentes), `MoneyTriad`, e setup `recharts` (`DonutChart`/`AreaTrend`/`WaterfallChart` base) estilizado com os tokens. Estabelece a estética. _New + consolida; instala `recharts`._ — _Feito em `components/financeiro/kit.tsx`; **recharts substituído por `ui/charts.jsx`** (decisão de consistência/bundle — DonutChart/Heatmap/Waterfall). Nota: resta 1 `KpiCard` duplicado — ver "Limpeza"._

## Vertical — Agenda
- [x] **[API] Estado `no_show`** na marcação (enum) + migração; separar de `cancelled`. — _Feito (migração `20260627120000-add-appointment-no-show.js`; funil inclui `no_show`)._
- [x] **[API] Métricas Agenda**: endpoint com faturado/recebido/em dívida, **valor médio por marcação**, **receita/hora de cadeira** (ocupação via `WorkingHours`), método de pagamento, novos/recorrentes/**perdidos (~60d)**, taxa de retorno, heatmap dia×hora, funil de estados. _Swagger + isolamento._ — _Feito (`GET /financeiro/agenda`)._
- [x] **[BO] Página Financeiro Agenda**: mini-dashboard profundo (tríade, KPIs, área, donut métodos, heatmap, funil, perdidos, top serviços). _Depends on: Shell, Kit visual, Métricas Agenda._ — _Feito (`pages/financeiro/FinanceiroAgenda.tsx`)._

## Vertical — Loja
- [x] **[API] Métricas Loja**: faturado líquido, **margem (COGS)**, **valor médio por compra**, devoluções, desconto dado, novos/recorrentes/**perdidos (~90d)**, **recompra**, **LTV**, top produtos/categorias c/ margem, **carrinhos abandonados** (usa `Cart`/`CartProduct`), **dead stock**. _Swagger + isolamento._ — _Feito (`GET /financeiro/loja`)._
- [x] **[BO] Página Financeiro Loja** + fluxo **"definir custo"** (lista de produtos sem `cost` → preencher → margem atualiza) + "% de produtos com custo". _Depends on: Shell, Kit visual, COGS, Métricas Loja._ — _Feito (`pages/financeiro/FinanceiroLoja.tsx`: aviso com % de cobertura da margem + CTA "Definir custos →" que abre a Loja)._

## Vertical — Ginásio
- [x] **[API] Gerar mensalidades do mês**: endpoint que cria os `GymPayment` em falta dos membros ativos do período + **cron mensal** (`startReminderJobs`/novo job). Torna cobrança/atraso verdadeiros. — _Feito (`POST /gym/mensalidade/generate` + cron mensal dia 1)._
- [x] **[API] Cobrança em massa + lembretes + análise**: marcar vários pagos numa chamada; endpoint "enviar lembrete" (`notifyUser` type `reminder`/`payment`); acrescentar **ARR** + **taxa de cobrança** + **MRR waterfall** + **em risco/assiduidade** (cruzar `WorkoutLog`) ao `getAnalytics`. _Swagger + isolamento._ — _Feito (`/gym/mensalidade/bulk-pay`, `/remind`, `/analytics` com ARR/taxa de cobrança/MRR waterfall/inativos)._
- [x] **[BO] Cobranças melhorada**: botão **Gerar mês**, **seleção múltipla** + `BulkChargeBar` (marcar pagos / enviar lembrete). _Modifica `CobrancasView`._ — _Feito, mas **reinventado** (cockpit gym-cobrancas, `.design/gym-cobrancas/`): mês **automático** (sem botão "Gerar mês") + **uma ação por linha** (sem `BulkChargeBar` na linha); mantém segmentação Por cobrar/Pagos/Todos + pesquisa._
- [x] **[BO] Sub-tab Clientes (roster)**: alunos com foto/plano/estado/assiduidade → ficha (`ClienteMensalidade`). Melhorar o modal **Registar pagamento**. _New sub-tab._ — _Feito, mas o roster foi **integrado na Cobranças** (lista de todos os membros com estado + pesquisa) em vez de sub-tab própria; `PagamentoModal` melhorado (`PriceFillChip`)._
- [x] **[BO] Análise rica**: ARR, taxa de cobrança, **MRR waterfall** (recharts), painel "em risco". _Modifica `AnaliseView`._ — _Feito (`AnaliseView`; waterfall/gráficos via `ui/charts.jsx`, não recharts)._

## Consolidado — O Negócio
- [x] **[API] Métricas consolidadas**: tríade total, distribuição de receita por fonte, série receita/despesa/lucro, **Score de saúde** (crescimento + retenção + %dívida + valor médio, com pesos). _Swagger._ — _Feito (`GET /financeiro/negocio`, com Score de saúde e receita por fonte)._
- [x] **[BO] O Negócio** (substitui `Financeiro.tsx`): `HealthScore` (anel + breakdown), tríade total, donut por fonte, área tendência, top global, resumo de despesas. _Depends on: Kit visual, Métricas consolidadas._ — _Feito (`pages/financeiro/ONegocio.tsx`; `Financeiro.tsx` antigo removido)._

## Interactions & States
- [x] **Estados em todas as vistas**: skeletons (loading), empty states com ação, erros, toasts (`sonner`) em mutações, drill-down (clique em top/ponto do gráfico), recálculo ao alternar IVA. Covers: default, loading, empty, error, hover. — _Feito (skeletons + `EmptyState` com ação + toasts nas mutações do ginásio; recálculo ao alternar IVA)._

## Responsive & Polish
- [x] **Mobile/tablet**: tabs e sub-tabs com scroll horizontal; KPIs 2 col; tabelas→listas (padrão `dense`); `BulkChargeBar` fixa no fundo. Breakpoints: 375 / 768 / 1280. — _Feito (grelhas `grid-cols-2 lg:grid-cols-4`, tabelas com `hidden`, tabs com scroll)._
- [ ] **Acessibilidade**: estado sempre cor+ícone+label; navegação por teclado (tabs/toggles/seleção/modais); focus rings; `aria-label`+alternativa textual nos charts; `prefers-reduced-motion`. — _Parcial: `role="img"`+`aria-label` no Heatmap/Waterfall e legenda textual no DonutChart; **falta** a tabela escondida com valores exatos para leitores de ecrã e a guarda `prefers-reduced-motion` no anel do `HealthScore` (DESIGN_REVIEW Should Fix #1 + Could Improve #1)._
- [ ] **Limpeza**: remover `Financeiro.tsx` antigo; confirmar que não sobra `KpiCard` duplicado; `/despesas` continua a abrir a tab certa. — _Parcial: `Financeiro.tsx` antigo removido ✓ e `/despesas` abre a tab certa ✓, mas **resta 1 `KpiCard` duplicado** (local em `GymMensalidade.tsx`, além do canónico em `kit.tsx`) — DESIGN_REVIEW Should Fix #2._

## Backend hardening
- [x] **[API] Segurança & testes** (delegar ao subagent `seguranca-api`): isolamento multi-tenant + casos abusivos + `@swagger` em todos os endpoints novos; correr a suite até passar. — _Feito (endpoints com `@swagger` no inventário; matriz RBAC + isolamento multi-tenant cobertos)._

## Review
- [ ] **Design review**: correr `/design-review` contra o brief (screenshots desktop/tablet/mobile + dark mode dos 5 separadores). — _Parcial: review **ao nível do código** feita (`DESIGN_REVIEW.md`); **falta a passagem visual com screenshots** (desktop/tablet/mobile + dark mode) — não havia browser/Playwright no ambiente._
```