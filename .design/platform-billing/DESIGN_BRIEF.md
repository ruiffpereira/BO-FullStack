# Design Brief: Subscrições da Plataforma (SaaS Billing)

_Criado 2026-07-02. Cobrar a cada tenant uma mensalidade recorrente para usar a app/backoffice, via Stripe Billing. Brief — **não construir ainda**._

> **⚠️ NÃO confundir com 3 coisas parecidas que já existem:**
> - **Checkout de ecommerce (T14):** o *cliente final* do tenant compra **produtos** na loja do tenant (pagamento único). Já feito.
> - **Mensalidades do ginásio:** os *sócios* do ginásio pagam ao *ginásio* (`GymSubscription`→`GymMembership`→`GymPayment`, registo manual). Já feito.
> - **Isto (Platform Billing):** o **tenant** (barbeiro/ginásio) paga **à plataforma** (a ti) para usar o software. Recorrente. **Novo, greenfield.**

---

## Problem

Hoje qualquer tenant usa o backoffice **de graça** — a plataforma tem custo (infra, dev) e **zero receita**. Não há forma de cobrar, medir quem paga, dar trial, nem cortar acesso a quem não paga. Para o produto deixar de operar "como agência" e passar a "SaaS", precisa de um motor de subscrição por tenant. O barbeiro há-de pagar ~15 €/mês, o ginásio ~30 €/mês, conforme o que usam.

## Solution

Um motor de **subscrição por tenant** montado sobre **Stripe Billing**: cada `User` (tenant) tem uma subscrição Stripe com **um item por módulo ativo** (soma dos preços). Trial de 14 dias com cartão à partida; ao falhar o pagamento, a app degrada para **read-only** (nunca apaga dados). O acesso ao backoffice passa a depender do **estado da subscrição** (uma camada nova por cima das permissões `VIEW_*`). Fase 1: **o dono cria as subscrições** para tenants conhecidos; self-serve fica para depois.

## Decisions (resolvidas com o dono, 2026-07-02)

| Decisão | Escolha | Nota |
|---|---|---|
| **Modelo de preço** | **Por vertical/módulo, soma** | Cada módulo ativo tem um preço (Agenda/barbeiro ~15 €, Ginásio ~30 €, Loja ~X €). Multi-vertical = soma dos itens. Bundle/cap fica para depois. |
| **Faturação certificada PT** | **Adiada (Stripe-only por agora)** | ⚠️ **Ver "Legal/Compliance". Decisão explícita do dono: construir o plumbing sem faturação.** Não conforme para cobrar clientes reais em PT — só serve para provar/testar. Cobrança real fica TRAVADA até integrar provider. |
| **Trial** | **14 dias, cartão upfront** | Converte sozinho no fim do trial; menos fricção de cobrança. |
| **Falha de pagamento** | **Grace ~7 dias → read-only** | Dunning do Stripe + grace; depois a app fica só-leitura (dados preservados, tenant regulariza). Nunca lock duro/apagar. |
| **Ativação** | **Dono cria primeiro; self-serve depois** | Fase 1 manual para tenants conhecidos; Fase 2 = signup self-serve (roadmap). |
| **Métodos de pagamento** | **Cartão (SEPA depois)** | MB WAY/Multibanco **não** fazem recorrência off-session — fora para auto-cobrança. Cartão agora; SEPA Direct Débito como extensão EU. |

## Legal/Compliance (o carve-out mais importante)

**Cobrar dinheiro a clientes em Portugal exige emissão de recibo/fatura certificada (SAF-T/AT). O Stripe NÃO emite documento fiscal português.** O dono escolheu **adiar** a faturação — logo:

- O que se constrói agora (subscrições Stripe + gating + trial + webhooks) é o **plumbing** e serve para **provar o modelo em teste** (chaves de teste, cartão 4242).
- **Antes de cobrar 1 € real a um tenant**, é OBRIGATÓRIO integrar um provider PT (Vendus / InvoiceXpress / Moloni) que emita o recibo certificado por cada `invoice.paid`. **Este brief trata a integração de faturação como um GATE de go-live, não como opcional.** O código deve ter um interruptor claro (`BILLING_LIVE=false`) que impede cobranças reais enquanto a faturação não existir.

## Experience Principles

1. **Confiança sobre pressão** — a cobrança nunca surpreende: trial com contagem visível, aviso antes de cobrar, recibo/histórico sempre acessível. O tenant sente-se no controlo, não apertado.
2. **Degradar, não punir** — falta de pagamento leva a **read-only com caminho claro de regularização**, não a uma porta trancada. Os dados do negócio do tenant são sagrados.
3. **Invisível quando pago, óbvio quando é preciso agir** — um tenant em dia quase não vê billing; um em trial-a-acabar ou em atraso vê um banner inequívoco com uma ação única.

## Aesthetic Direction

- **Philosophy**: consistente com o backoffice atual (utilitário, calmo, `ui/ui.jsx` — Card/Button/Badge/Tabs, pílulas segmentadas, accent). Billing não é um sítio para criatividade — é para clareza e confiança.
- **Tone**: sóbrio, transparente, tranquilizador. Zero *dark patterns*.
- **Reference points**: a página de billing do Linear / Vercel (estado do plano + método + faturas, tudo numa vista), o Stripe Customer Portal (para gestão do cartão/faturas — reutilizável tal-qual).
- **Anti-references**: páginas de billing que escondem o botão de cancelar, que gritam "UPGRADE", ou que trancam a conta sem aviso.

## Existing Patterns

- **Tipografia/cor/espaço:** herda o design system do Backoffice (`src/ui/ui.jsx`, tokens Tailwind). Sem novos tokens.
- **Componentes reutilizáveis:** `Card`, `Button`, `Badge`, `Tabs`, `PageHeader`, `Modal`, `EmptyState`, `PriceFillChip` (padrão de pílula de preço). O padrão de gate por permissão (`Shell.tsx` → `accessiblePaths`, `hasPermission`) é o sítio onde entra o **novo gate por estado de subscrição**.
- **Auth/gate atual:** `AuthContext` (JWT + refresh) decide o `user` + permissões; `Shell.tsx` decide as rotas visíveis por `VIEW_*`. O estado da subscrição é uma **nova dimensão ortogonal** a isto (podes ter permissão mas estar `past_due`).
- **Stripe já no repo:** a API já usa `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` e um webhook (`/api/webhook/stripe`) para o ecommerce (T14). O billing da plataforma **reutiliza a infra do webhook** (mais tipos de evento) mas é um domínio separado.

## Architecture & Data Model (o "como", em resumo)

- **Stripe objects:**
  - **Customer** — 1 por tenant (`User`). Guardar `stripeCustomerId` no tenant.
  - **Product + Price** — 1 Price recorrente **por módulo** (agenda/gym/loja/…), mensal, EUR. Catálogo pequeno, gerido no Stripe (ou seed).
  - **Subscription** — 1 por tenant, com **vários subscription items** (um por módulo ativo). Trial de 14 dias (`trial_period_days`), `payment_behavior` que exige cartão à partida.
- **Novo modelo `PlatformSubscription`** (por `userId`) — espelho local do estado Stripe (fonte de verdade = Stripe; isto é cache para o gate e para a UI):
  `stripeCustomerId`, `stripeSubscriptionId`, `status` (`trialing|active|past_due|canceled|incomplete`), `modules` (lista de módulos cobrados), `trialEnd`, `currentPeriodEnd`, `cancelAt`, `updatedAt`.
- **Webhooks** (estender o handler existente): `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming` (aviso pré-cobrança). Cada um atualiza o `PlatformSubscription` local. **Idempotência + assinatura** como já se faz no T14.
- **Gate de acesso (a peça nova de produto):** uma camada em `AuthContext`/`Shell` (BO) e/ou no middleware da API:
  - `trialing`/`active` → acesso total.
  - `past_due` (dentro do grace) → acesso total + banner de aviso.
  - `past_due` (grace esgotado) → **read-only** (GETs sim, POST/PUT/DELETE bloqueados com uma mensagem "regulariza o pagamento"), exceto a própria página de billing.
  - `canceled` → read-only + só billing (para reativar ou exportar).
  - **Nunca** apagar dados por falta de pagamento.
- **Interruptor de go-live:** env `BILLING_LIVE` (default `false`). Enquanto `false`, o plumbing corre mas **nenhuma cobrança real** é feita a tenants — protege contra faturar sem o recibo certificado (ver Legal).

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| Página **Faturação** (BO, tenant) | Novo | Plano atual (módulos + total/mês), estado (trial/ativo/em atraso), método de pagamento, histórico de faturas, botão gerir/cancelar. Core ou gated a admin do tenant. |
| **Trial/past-due banner** (Shell) | Novo | Faixa no topo: "Trial acaba em N dias" / "Pagamento falhou — regulariza". Uma ação única. |
| **Plan/módulos picker** | Novo | Mostra os módulos e preços; na fase manual é read-only (o dono define), self-serve depois deixa escolher. |
| Integração **Stripe Customer Portal** | Novo (reutiliza Stripe) | Gerir cartão/faturas/cancelar sem construir UI própria — link para o portal hospedado do Stripe. Mais rápido e seguro. |
| **Stripe Checkout (subscription mode)** | Novo (reutiliza Stripe) | Para o tenant introduzir o cartão e iniciar a subscrição (fase self-serve). Na fase manual, o dono cria via API/dashboard. |
| **Read-only gate** | Novo | Bloqueio de escrita transversal quando o estado o exige (middleware API + guarda no BO). |
| Painel **admin de subscrições** (dono) | Novo | O dono vê/cria/gere subscrições dos tenants (fase 1). Vive no `Admin.tsx` (VIEW_ADMIN). |
| `PlatformSubscription` model + migração | Novo | API. |
| Webhook handler (estender) | Modificar | Novos tipos de evento de billing. |

## Key Interactions

- **Dono cria subscrição (fase 1):** Admin → escolhe tenant + módulos → cria Stripe Customer+Subscription (trial 14d) → tenant recebe email para pôr o cartão (Stripe Checkout/Portal) → estado `trialing`.
- **Trial a acabar:** banner desde D-3; no fim, Stripe tenta cobrar o cartão → `invoice.paid` → `active` (ou `past_due` se falhar).
- **Pagamento falha:** `invoice.payment_failed` → `past_due` + banner; Stripe faz dunning (retries); grace de 7 dias; se não regularizar → read-only.
- **Regularizar:** tenant vai à Faturação → Portal do Stripe → atualiza cartão → `invoice.paid` → volta a `active` + acesso total.
- **Cancelar:** via Portal; `cancel_at_period_end` → mantém acesso até ao fim do período pago, depois read-only.

## Responsive Behavior

Página de Faturação e banners seguem o BO (mobile-first já existente): cartões empilham, o banner ocupa a largura no topo. O Stripe Portal/Checkout são responsivos por natureza (hospedados).

## Accessibility Requirements

- Banners de trial/atraso com `role="status"`/`role="alert"` conforme urgência; contraste AA; a ação (regularizar) é um botão real, focável.
- O estado read-only tem de ser **anunciado** (não só botões desativados silenciosamente) — mensagem clara do porquê e como resolver.
- Nada de tempo-limite que tranque o utilizador a meio de uma ação.

## Phasing (proposta — decidir em brief-to-tasks)

1. **Plumbing (Fase 1):** modelo `PlatformSubscription` + Stripe Customer/Price/Subscription (dono cria) + webhooks + gate de acesso (trial/active/past_due→read-only) + página Faturação (ver estado + Portal) + `BILLING_LIVE=false`. **Testável em Stripe test.**
2. **Self-serve (Fase 2):** signup público → escolher módulos → Stripe Checkout (subscription) → trial → onboarding. (Liga ao roadmap "Activation".)
3. **Faturação certificada (Fase 3) — GATE de go-live:** integrar Vendus/InvoiceXpress/Moloni; por cada `invoice.paid`, emitir recibo certificado; só então `BILLING_LIVE=true`. **Sem isto não se cobra 1 € real.**
4. **Polish (Fase 4):** SEPA Direct Débito, e-mails de ciclo de vida (dunning, trial-ending, win-back), bundle/caps de preço, cupões de plataforma.

## Out of Scope

- **Faturação certificada PT** — adiada por decisão do dono; tratada como **gate de go-live** (Fase 3), não construída agora. **Cobrança real de clientes fica bloqueada até lá.**
- **Self-serve signup / onboarding** — Fase 2 (o plumbing assume subscrições criadas pelo dono primeiro).
- **Checkout de ecommerce (T14)** e **mensalidades do ginásio** — domínios diferentes, já existem; não mexer.
- **MB WAY/Multibanco recorrentes** — tecnicamente inviável off-session; fora.
- **Métricas/relatórios de MRR da plataforma** — úteis, mas depois (o Stripe já dá dashboards no início).
