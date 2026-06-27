# Build Tasks: Financeiro (redesign)

Generated from: .design/financeiro/DESIGN_BRIEF.md + INFORMATION_ARCHITECTURE.md
Date: 2026-06-27

Legenda: **[API]** = `API-FullStack` · **[BO]** = `Backoffice`. Após mudar specs da API correr `pnpm kubb` no BO.
Philosophy a estabelecer no 1º slice visual: **calm financial dashboard** (Stripe/Linear/Lemon Squeezy).

## Foundation (primeiro — desbloqueia dados certos + direção estética)
- [ ] **[API] Corrigir receita da Loja**: excluir `cancelled`/`refunded` e respeitar `endDate` em `ecommerceStats`. Define receita **líquida**. _Bug; barato; alto impacto._
- [ ] **[API] Custo (COGS)**: campo `cost` em `Product` + snapshot `costAtPurchase` em `OrderProduct` (gravado no checkout) + migração. Base da margem real. _New field._
- [ ] **[API] IVA por item**: `vatRate` (nullable) em `Product`, `Service`, `GymSubscription` + migração; helper para aplicar/remover IVA. _New field._
- [ ] **[API] Helpers de dinheiro partilhados**: funções `faturado`/`recebido`/`emDivida` consistentes reutilizadas por todos os verticais (competência vs caixa). _Refactor dashboard controller._
- [ ] **[BO] Shell do Financeiro**: `FinanceiroPage` com tabs **O Negócio·Agenda·Loja·Ginásio·Despesas** gated por permissão, estado na URL (`?vista=`), **PeriodPicker + toggle c/IVA·s/IVA partilhados** no cabeçalho. _Modifica `FinanceiroPage.tsx`; reusa `Tabs`, `DateRangePicker`._
- [ ] **[BO] Kit visual partilhado**: `KpiCard` **unificado** (funde os 2 existentes), `MoneyTriad`, e setup `recharts` (`DonutChart`/`AreaTrend`/`WaterfallChart` base) estilizado com os tokens. Estabelece a estética. _New + consolida; instala `recharts`._

## Vertical — Agenda
- [ ] **[API] Estado `no_show`** na marcação (enum) + migração; separar de `cancelled`.
- [ ] **[API] Métricas Agenda**: endpoint com faturado/recebido/em dívida, **valor médio por marcação**, **receita/hora de cadeira** (ocupação via `WorkingHours`), método de pagamento, novos/recorrentes/**perdidos (~60d)**, taxa de retorno, heatmap dia×hora, funil de estados. _Swagger + isolamento._
- [ ] **[BO] Página Financeiro Agenda**: mini-dashboard profundo (tríade, KPIs, área, donut métodos, heatmap, funil, perdidos, top serviços). _Depends on: Shell, Kit visual, Métricas Agenda._

## Vertical — Loja
- [ ] **[API] Métricas Loja**: faturado líquido, **margem (COGS)**, **valor médio por compra**, devoluções, desconto dado, novos/recorrentes/**perdidos (~90d)**, **recompra**, **LTV**, top produtos/categorias c/ margem, **carrinhos abandonados** (usa `Cart`/`CartProduct`), **dead stock**. _Swagger + isolamento._
- [ ] **[BO] Página Financeiro Loja** + fluxo **"definir custo"** (lista de produtos sem `cost` → preencher → margem atualiza) + "% de produtos com custo". _Depends on: Shell, Kit visual, COGS, Métricas Loja._

## Vertical — Ginásio
- [ ] **[API] Gerar mensalidades do mês**: endpoint que cria os `GymPayment` em falta dos membros ativos do período + **cron mensal** (`startReminderJobs`/novo job). Torna cobrança/atraso verdadeiros.
- [ ] **[API] Cobrança em massa + lembretes + análise**: marcar vários pagos numa chamada; endpoint "enviar lembrete" (`notifyUser` type `reminder`/`payment`); acrescentar **ARR** + **taxa de cobrança** + **MRR waterfall** + **em risco/assiduidade** (cruzar `WorkoutLog`) ao `getAnalytics`. _Swagger + isolamento._
- [ ] **[BO] Cobranças melhorada**: botão **Gerar mês**, **seleção múltipla** + `BulkChargeBar` (marcar pagos / enviar lembrete). _Modifica `CobrancasView`._
- [ ] **[BO] Sub-tab Clientes (roster)**: alunos com foto/plano/estado/assiduidade → ficha (`ClienteMensalidade`). Melhorar o modal **Registar pagamento**. _New sub-tab._
- [ ] **[BO] Análise rica**: ARR, taxa de cobrança, **MRR waterfall** (recharts), painel "em risco". _Modifica `AnaliseView`._

## Consolidado — O Negócio
- [ ] **[API] Métricas consolidadas**: tríade total, distribuição de receita por fonte, série receita/despesa/lucro, **Score de saúde** (crescimento + retenção + %dívida + valor médio, com pesos). _Swagger._
- [ ] **[BO] O Negócio** (substitui `Financeiro.tsx`): `HealthScore` (anel + breakdown), tríade total, donut por fonte, área tendência, top global, resumo de despesas. _Depends on: Kit visual, Métricas consolidadas._

## Interactions & States
- [ ] **Estados em todas as vistas**: skeletons (loading), empty states com ação, erros, toasts (`sonner`) em mutações, drill-down (clique em top/ponto do gráfico), recálculo ao alternar IVA. Covers: default, loading, empty, error, hover.

## Responsive & Polish
- [ ] **Mobile/tablet**: tabs e sub-tabs com scroll horizontal; KPIs 2 col; tabelas→listas (padrão `dense`); `BulkChargeBar` fixa no fundo. Breakpoints: 375 / 768 / 1280.
- [ ] **Acessibilidade**: estado sempre cor+ícone+label; navegação por teclado (tabs/toggles/seleção/modais); focus rings; `aria-label`+alternativa textual nos charts; `prefers-reduced-motion`.
- [ ] **Limpeza**: remover `Financeiro.tsx` antigo; confirmar que não sobra `KpiCard` duplicado; `/despesas` continua a abrir a tab certa.

## Backend hardening
- [ ] **[API] Segurança & testes** (delegar ao subagent `seguranca-api`): isolamento multi-tenant + casos abusivos + `@swagger` em todos os endpoints novos; correr a suite até passar.

## Review
- [ ] **Design review**: correr `/design-review` contra o brief (screenshots desktop/tablet/mobile + dark mode dos 5 separadores).
```