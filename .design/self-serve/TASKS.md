# Build Tasks: Self-Serve Signup & Activation

Generated from: .design/self-serve/DESIGN_BRIEF.md + INFORMATION_ARCHITECTURE.md
Date: 2026-07-03 · Execução: agentes Sonnet + review adversarial; tokens saltados (sistema visual existente)

## Foundation (API)
- [ ] **T1 — Trial local expira**: `computeBillingAccess` trata `trialing` com `trialEnd`/`currentPeriodEnd` no passado → `{readOnly:true, reason:"trial_expired"}`; `GET /billing/subscription` expõe o reason novo. Testes de accessPolicy (todas as transições). _Modifica: src/billing/accessPolicy.ts._
- [ ] **T2 — Signup público**: `POST /users/signup` (zod: businessName, email, vertical, modules[]) — cria User sem password + setupToken/24h, **role por-tenant** com os componentes dos módulos escolhidos (+core), `PlatformSubscription` local `trialing` (trialEnd +14d, modules, monthlyTotalCents do catálogo — módulos `active` apenas), email de verificação (reutiliza sendPasswordSetupEmail; se o email já existir → mesmo 200 genérico + email «já tens conta»), `notifyUser` aos admins. `authRateLimit`. Transação (rollback total em falha). Swagger completo. _Novo: controllers/routes; reutiliza userController helpers._
- [ ] **T3 — Reenvio de verificação**: `POST /users/signup/resend` (email) — rate-limited, anti-enumeração (200 sempre), regenera setupToken só para contas ainda sem password. Swagger. _Novo endpoint pequeno._
- [ ] **T4 — Catálogo público**: `GET /billing/catalog` público devolve só `{module,label,monthlyAmountEur,active}` dos ativos (sem stripeProductId/ids internos). `publicRateLimit`. Swagger. _Novo endpoint read-only._
- [ ] **T5 — Estender trial (dono)**: `PATCH /admin/billing/subscriptions/:userId/trial {days}` (`VIEW_ADMIN`) — soma dias ao trialEnd (a partir de max(now, trialEnd)), só para subscrições locais sem Stripe; devolve estado novo. Swagger + testes. _Modifica: billingAdminController._
- [ ] **T6 — Segurança do signup**: testes de isolamento/abuso (agente seguranca-api): anti-enumeração, rate-limit, mass-assignment (não aceitar permissionId/status/userId), módulos inválidos/inativos → 400, transação sem tenants meio-criados, token single-use. _Testes novos._

## Core UI (Backoffice — depois do commit da API + kubb refresh)
- [ ] **T7 — Kubb refresh**: dumpSpec offline → spec.json → `pnpm kubb`; hooks novos (signup/catalog/trial) gerados. _Tooling._
- [ ] **T8 — Página /signup**: standalone (par do Login), passo 1 (vertical radio-cards + nome + email, `?vertical=` pré-seleciona) → passo 2 (módulos pré-marcados + preços do catálogo público + total €/mês live + selo «14 dias grátis, sem cartão») → estado «vê o teu email» (role=status). Link «Criar conta» no Login. Mobile-first, foco gerido entre passos. Testes unit (fluxo completo mockado, anti-enumeração no UI, total recalcula). _Novo: src/pages/Signup.tsx; reutiliza ui.jsx + billingStatus labels._
- [ ] **T9 — Estados trial_expired**: `billingStatus.ts` (badge/label vermelho «período experimental terminado»), `BillingBanner` (ramo vermelho role=alert, «fala connosco» → /mensagens + «Ver faturação»), `Faturacao.tsx` (bloco de estado com CTA suporte). Testes unit dos 3. _Modifica._
- [ ] **T10 — Estender trial no Admin**: `AdminBilling.tsx` — ação «Estender trial» (input dias, default 14) nas linhas com subscrição local/trial; badge trial_expired; invalida queries. Testes unit (payload certo, só aparece quando aplicável). _Modifica._

## Interactions & States (Backoffice)
- [ ] **T11 — FirstValueChecklist no Dashboard**: bloco por vertical (deriva de permissões + dados existentes: agenda→tem serviço?/horário? · gym→tem subscrição?/cliente? · loja→tem produto? · core→tem cliente?), itens deep-link, auto-completam, dispensável (localStorage por user). Colapsa em acordeão <md. Testes unit (por vertical + dismissal). _Novo componente; Dashboard.tsx integra no topo._

## Review
- [ ] **T12 — Review adversarial** (Workflow): dimensões segurança-signup (enumeração/abuso/mass-assignment/transação) + billing (trial local, expiry, extend) + UX-estados. Aplicar findings via agente. 
- [ ] **T13 — Design review** (code-level; screenshots quando houver browser) contra o brief.
- [ ] **T14 — Docs**: CLAUDE.md (API + BO) + FUNCIONALIDADES.md + este TASKS com checkboxes; commits limpos por fatia (API primeiro, BO depois). Sem push.

## Deferred (fora desta fase — ver Out of Scope do brief)
- e2e Playwright do fluxo signup (juntar à dívida 5.3 do roadmap — e2e chat/site-engine; correr quando o grant do api_e2e estiver restaurado).
- Cartão/Stripe no signup (Fase 3) · captcha · lifecycle emails · provisionamento do site (Fase 2).
