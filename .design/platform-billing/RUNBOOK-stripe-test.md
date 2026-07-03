# Runbook — Provar o Platform Billing (+ checkout) em Stripe TEST

_T7 do platform billing. Prova o fluxo real end-to-end em **modo de teste** do Stripe (cartão 4242, sem dinheiro real). Nada disto foi corrido autonomamente — precisa das TUAS chaves Stripe + o Stripe CLI. Todos os testes automáticos existentes usam o Stripe **mockado**; isto é a prova com o Stripe **real (test mode)**._

> **Guard legal:** mantém `BILLING_LIVE=false` (default). Com chaves `sk_test_`/`pk_test_` corre sempre. Só passes a `sk_live_` + `BILLING_LIVE=true` **depois** de integrar a faturação certificada PT (Fase 3). O `assertBillingAllowed()` bloqueia `sk_live_` sem `BILLING_LIVE`.

## 0. Pré-requisitos (uma vez)
1. **Migrações** (dev DB da API):
   ```bash
   cd API-FullStack && pnpm sequelize-cli db:migrate
   # aplica: 20260702120000 (checkout/stripePaymentIntentId) + 20260702130000 (platform_subscriptions)
   ```
2. **Seed dos Prices** da plataforma no teu Stripe test (cria Product+Price/módulo e imprime os IDs):
   ```bash
   cd API-FullStack && STRIPE_SECRET_KEY=sk_test_... pnpm seed:billing
   # cola o output nas envs: STRIPE_PRICE_AGENDA / STRIPE_PRICE_GYM / STRIPE_PRICE_LOJA
   ```
3. **Envs** (dev):
   - API: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=<do stripe listen, passo 1>`, `STRIPE_PRICE_*=…`, `BILLING_LIVE=false`, `BACKOFFICE_URL=http://localhost:5173`.
   - Backoffice: `NEXT?`→ é Vite: `VITE_…` não aplica ao Stripe da plataforma (o cartão do tenant introduz-se via **Stripe Customer Portal/Checkout hospedado**, não Elements no BO). Para o **checkout do ecommerce** (site-engine): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`.

## 1. Webhook local (Stripe CLI)
```bash
stripe login
stripe listen --forward-to localhost:3001/api/webhook/stripe
# copia o whsec_… -> STRIPE_WEBHOOK_SECRET da API; deixa este terminal aberto
```
Arranca a API (`pnpm dev`) e o Backoffice (`pnpm dev`).

## 2. Provar as SUBSCRIÇÕES DA PLATAFORMA (o que o teu "barbeiro 15€/gym 30€" precisa)

### 2a. Criar a subscrição (como dono)
- Backoffice → **Admin → Faturação** (tab, VIEW_ADMIN) → **Criar subscrição** → escolhe um tenant + módulos (ex.: `gym` = 30€) → Criar.
- Verás no terminal do `stripe listen`: `customer.subscription.created` (status `trialing`).
- Confirma: **Faturação** (como esse tenant) mostra "Período de teste — termina a …" + total 30€/mês.

### 2b. Tenant põe o cartão
- Na Faturação do tenant → **Gerir pagamento** → abre o **Stripe Customer Portal** (test mode) → adiciona o cartão **4242 4242 4242 4242**, validade futura, qualquer CVC.

### 2c. Avançar o tempo (test clock) → cobrança automática
O trial é 14 dias; para não esperar, usa um **Stripe Test Clock**:
- Cria o Customer com um test clock (via dashboard test / API) OU, mais simples para provar a transição, no dashboard test **Subscriptions → … → avançar o relógio** para além do `trial_end`.
- O Stripe cobra o cartão → webhook `invoice.paid` → a subscrição fica **`active`**. Confirma na Faturação: "Ativa · Próxima renovação: …".

### 2d. Provar o gate read-only (falha de pagamento)
- No dashboard test, força uma falha: usa o cartão **4000 0000 0000 0341** (falha na cobrança recorrente) como método por defeito, ou cancela/expira o pagamento e avança o relógio.
- Webhook `invoice.payment_failed` → estado **`past_due`**. Na Faturação aparece o aviso âmbar (grace) + o **banner** no topo do backoffice.
- Passados 7 dias (avança o relógio para além de `currentPeriodEnd + 7d`) → o `computeBillingAccess` passa a **read-only**: um **POST/PUT/DELETE** numa rota de gestão (ex.: criar uma despesa) devolve **402** e os botões de escrita ficam bloqueados; os **GET** continuam a funcionar; `/faturacao` e o suporte continuam acessíveis.
- Regulariza (Portal → novo cartão) → `invoice.paid` → **`active`** → acesso total volta de imediato.

## 3. Provar o CHECKOUT DO ECOMMERCE (T14 — cliente compra produto)
_(Distinto: o cliente final do tenant compra um produto; pagamento único.)_
- Precisa de um tenant real com **site publicado + produtos** resolvível por hostname (o site-engine). Com isso:
  1. No site do tenant → adicionar produto ao carrinho (exige login de cliente) → `/checkout` → morada → **Pagar** → Stripe Elements com **4242** → confirmar.
  2. `stripe listen` mostra `payment_intent.succeeded` → a encomenda passa **pending → processing**, stock decrementa, carrinho limpa, email de confirmação.
  3. **Free order:** aplica um cupão que cobre o total → o checkout salta o Stripe e vai direto ao sucesso (order paga sem pagamento).
- **Double-charge:** confirma dois clientSecrets distintos da mesma order → o 2.º `payment_intent.succeeded` marca a order `[REVIEW]` + notifica o dono (não descarta em silêncio).

## Cartões de teste úteis (Stripe)
- `4242 4242 4242 4242` — sucesso.
- `4000 0000 0000 3220` — exige 3DS (autenticação).
- `4000 0000 0000 0341` — falha ao cobrar (recorrência) → past_due.
- `4000 0000 0000 9995` — fundos insuficientes.

## O que confirmar no fim
- [ ] Subscrição criada (dono) → trialing → cartão → active (via test clock).
- [ ] Falha → past_due → grace → read-only (402) → regularizar → active.
- [ ] Banner do backoffice aparece/desaparece conforme o estado.
- [ ] Checkout ecommerce: pending→processing via webhook; free-order; double-charge → [REVIEW].
- [ ] Nada cobrou dinheiro real (test mode); `BILLING_LIVE=false`.
