# Build Tasks: Subscrições da Plataforma (Platform Billing)

Gerado de: `.design/platform-billing/DESIGN_BRIEF.md` · 2026-07-02
**Abrange 2 codebases:** `[API]` API-FullStack · `[BO]` Backoffice.
**Consumo API→BO via Kubb+zod** (regra do projeto): sempre que a API muda o spec, corrigir o swagger → `pnpm kubb`.

> **⚠️ Regra transversal (todas as tarefas):** `BILLING_LIVE=false` por defeito — o plumbing corre e testa-se com **chaves Stripe de teste** (cartão 4242), mas **nenhuma cobrança real** a tenants até a **faturação certificada PT** existir (Fase 3, gate legal de go-live). Não remover este interruptor sem a Fase 3.
> **Estratégia de ordem:** **fatia end-to-end fina primeiro** (T1–T4: criar uma subscrição de teste → webhook atualiza estado local → o tenant vê o estado → o gate funciona) para desriscar a arquitetura antes de investir na UI toda.

---

## FASE 1 — Plumbing testável (o dono cria as subscrições)

### Foundation — fatia end-to-end (risco primeiro)
- [ ] **T1 · Modelo + Stripe Customer/Price/Subscription** `[API]`: modelo `PlatformSubscription` por `userId` (`stripeCustomerId`, `stripeSubscriptionId`, `status`, `modules[]`, `trialEnd`, `currentPeriodEnd`, `cancelAt`) + **migração** (dono corre). Catálogo de **Price recorrente por módulo** (agenda/gym/loja) no Stripe (seed/script). Serviço `createTenantSubscription(userId, modules[])` → cria/obtém Stripe Customer, cria Subscription com 1 item por módulo + `trial_period_days:14` + cartão exigido à partida. Env `BILLING_LIVE` (guard). _Risco central; sem UI ainda — prova via script/test que a subscrição nasce em Stripe test + a linha local._
- [ ] **T2 · Webhooks de billing** `[API]`: estender o handler `/api/webhook/stripe` (reutiliza assinatura+idempotência do T14) para `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.upcoming` → atualiza `PlatformSubscription` local (Stripe = fonte de verdade). Testes de integração: cada evento leva ao estado certo; idempotente. _Depende de T1._
- [ ] **T3 · Gate de acesso por estado + endpoint de estado** `[API]`: `GET /api/billing/subscription` (estado do tenant autenticado). Middleware **read-only** por estado: `trialing`/`active`→total; `past_due` dentro do grace (7d)→total; grace esgotado/`canceled`→**bloqueia POST/PUT/DELETE** (exceto rotas de billing) com 402/403 + mensagem "regulariza o pagamento". **Nunca** apagar dados. Testes: matriz de estados × métodos. _Depende de T1; isolamento por `userId`._
- [ ] **T4 · Página Faturação (tenant)** `[BO]`: `pnpm kubb` (novos endpoints) → página **Faturação** (core ou gated a admin do tenant): plano atual (módulos + total/mês), estado (trial/ativo/em atraso com badge), `currentPeriodEnd`, e **link para o Stripe Customer Portal** (gerir cartão/faturas/cancelar — sem UI própria). Reusa `Card/Badge/Button/PageHeader`. Estados: sem subscrição / trial / ativo / em atraso / cancelado. _← 1.ª fatia visível end-to-end. Depende de T3._

### Core — gate na UI + criação pelo dono
- [~] **T5 · Banner + read-only guard no BO** `[BO]`: faixa no `Shell.tsx` (trial a acabar em N dias · pagamento falhou — regulariza), `role=status`/`alert` por urgência, ação única. Guarda de escrita no BO coerente com o gate da API (botões de escrita desativados **com mensagem anunciada** quando o estado é read-only; billing sempre acessível). _Depende de T3/T4._ — **Banner ✅ 2026-07-03** (`src/components/BillingBanner.tsx` no Shell; trial ≤3d dispensável, grace âmbar, locked/canceled vermelho; unit+e2e) + **des-stub do portal na Faturação ✅** (`usePostBillingPortal` → redirect). **Falta:** guarda de escrita transversal no BO (desativar POST/PUT/DELETE quando `readOnly`) — a API já bloqueia (402); o BO ainda não reflete os botões.
- [x] **T6 · Painel admin de subscrições (dono)** `[BO+API]`: em `Admin.tsx` (`VIEW_ADMIN`), o dono lista tenants + estado da subscrição, e **cria/gere** uma subscrição para um tenant (escolhe módulos → dispara `createTenantSubscription` → tenant recebe email p/ pôr o cartão via Checkout/Portal). Endpoint admin correspondente na API (gated `VIEW_ADMIN`). _Depende de T1._ — **✅ 2026-07-03** (BO: `AdminBillingTab` em `src/components/AdminBilling.tsx` → tab "Faturação" no Admin; lista via `useGetAdminBillingSubscriptions`, cria via `usePostAdminBillingSubscriptions` com módulos agenda/gym/loja; erros 400/402/404 tratados. API já expõe os endpoints. Unit+e2e).

### Prova
- [ ] **T7 · Stripe test e2e (plumbing)** `[API]`: com `stripe listen` + test clock, provar o ciclo: criar subscrição (trial) → avançar o relógio → `invoice.paid`→`active` → forçar falha (cartão de teste que recusa) → `past_due` → grace → read-only → regularizar → `active`. Documentar o runbook. _Fecho da Fase 1; não precisa de faturação certificada (só test mode)._

---

## FASE 2 — Self-serve (signup → escolher módulos → pagar)
- [ ] **T8 · Signup self-serve + trial** `[API+BO]`: registo público de tenant → escolher módulos → **Stripe Checkout (subscription mode)** → trial → provisiona defaults. Liga ao roadmap "Activation" (Fases 3/5 do plano do site-engine). Segurança de auth (rate-limit, verificação de email). _Grande; brief próprio provável._

## FASE 3 — Faturação certificada PT (GATE DE GO-LIVE — bloqueante legal)
- [ ] **T9 · Integrar provider PT** `[API]`: escolher **Vendus / InvoiceXpress / Moloni**; por cada `invoice.paid`, emitir **recibo/fatura certificada** com os dados fiscais do tenant; guardar a referência. Só depois **`BILLING_LIVE=true`**. **Sem isto NÃO se cobra 1 € real** (SAF-T/AT). _Pré-requisito legal absoluto antes de faturar._

## FASE 4 — Polish
- [ ] **T10 · SEPA + e-mails de ciclo de vida + preço** `[API+BO]`: SEPA Direct Débito (recorrência EU alternativa ao cartão); e-mails (dunning, trial-a-acabar, win-back); bundles/caps de preço; cupões de plataforma; dashboard de MRR.

---

## Review (por fatia, como no T14)
- [ ] **Cada fatia:** loop build → **review adversarial** (Workflow: isolamento, idempotência de webhook, correção do gate, dinheiro) → aplicar findings → commit.
- [ ] **Design review** da página Faturação + banners contra o brief.

## Fora do v1 (não fazer)
- Cobrança real antes da Fase 3 (bloqueado por `BILLING_LIVE`).
- MB WAY/Multibanco recorrentes (inviável off-session).
- Relatórios avançados de MRR (o dashboard Stripe chega no início).
