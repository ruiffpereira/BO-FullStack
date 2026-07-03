# Design Brief: Self-Serve Signup & Activation

> Fase 1 do [ROADMAP-EXECUCAO.md](../../../ROADMAP-EXECUCAO.md). Decisões tomadas em entrevista (grill) a 2026-07-03;
> infra verificada por scout ao código. Construção 100% por agentes (Sonnet) com review adversarial.

## Problem

Um barbeiro, dono de ginásio ou lojista descobre a plataforma e quer experimentá-la **agora** — mas hoje
não consegue: a conta tem de ser criada à mão pelo dono da plataforma (`POST /users/register`, gated a
`VIEW_ADMIN`). O interessado espera; o dono faz trabalho manual por cada cliente; ninguém escala.
Do lado de quem chega, a fricção é: "quero ver se isto serve para o meu negócio, sem falar com ninguém
e sem dar o cartão".

## Solution

Uma página pública de signup em 2 passos onde o interessado escolhe o **tipo de negócio** (a língua dele,
não "módulos"), vê **preços transparentes** com selo "14 dias grátis", e cria conta **sem cartão**.
Verifica o email por link (o mesmo passo define a password — 1 clique, 1 formulário), e cai num Dashboard
que lhe mostra **o caminho para o primeiro valor** (checklist por vertical: criar o 1.º serviço, a 1.ª
subscrição, o 1.º produto). O trial expira para read-only com um caminho humano ("fala connosco") e o dono
da plataforma pode estender ou ativar caso-a-caso no Admin.

## Experience Principles

1. **Fricção zero até ao valor, não até à venda** — sem cartão, sem aprovação manual, sem wizard longo;
   a única barreira é provar o email (que é também a defesa anti-abuso).
2. **Transparência sobre surpresa** — preços €/mês visíveis desde o 1.º ecrã, mesmo sem cobrança ativa;
   quando a cobrança ligar, ninguém é apanhado de surpresa.
3. **A app guia, não bloqueia** — o onboarding vive no Dashboard como checklist dispensável, não como
   wizard obrigatório; o tenant explora à vontade.

## Aesthetic Direction

- **Philosophy**: a mesma do Backoffice (calma, zinc + accent, Cards arredondados) — o signup é o par
  do `Login.tsx` existente (standalone, sem Shell), não uma landing de marketing.
- **Tone**: confiante, direto, PT.
- **Reference points**: Login.tsx atual; fluxos de signup Stripe/Linear (passos curtos, progresso claro).
- **Anti-references**: signup multi-página com 10 campos; landing agressiva de SaaS com contagem decrescente.

## Existing Patterns (verificado por scout)

- Typography/cores/espaçamento: Tailwind + primitivas `src/ui/ui.jsx` (`Card`, `Button`, `Input`,
  `Badge`, `Tabs`, `SectionTitle`); accent via classes `text-accent`/`bg-accent`.
- `Login.tsx` = página standalone sem Shell — o `/signup` segue o mesmo esqueleto.
- Fluxo setup-password **reutilizável tal-e-qual**: token 32-byte hex + 24h (`User.setupToken/Expiry`),
  email via Resend (`sendPasswordSetupEmail`, `BACKOFFICE_URL`), página `SetupPassword.tsx`, endpoint
  público `POST /users/setup-password` (single-use, limpa o token).
- Billing plumbing: catálogo `BillingModulePrice` (preços em BD), `PlatformSubscription` (campos Stripe
  nullable → trial local representável), `computeBillingAccess`, `BillingBanner`, `billingStatus.ts`,
  `AdminBilling.tsx`, write-guard (`useBillingReadOnly`/`GuardButton`).
- Rate-limit: `authRateLimit` (prod: 10/min/IP) já protege o `/setup-password`; padrão a reutilizar.
- Notificações: `notifyUser()` + `getAdminUserIds()` (chat) para avisar o dono de cada signup.

## Component Inventory

| Component | Status | Notes |
|-----------|--------|-------|
| `Signup.tsx` (página pública) | New | Par do Login; 2 passos + estado "verifica o email" |
| `SetupPassword.tsx` | Exists | Reutilizada tal-e-qual como passo de verificação (copy já serve) |
| Cartões de vertical (Barbearia/Salão · Ginásio · Loja · Outro) | New | Dentro do Signup; pré-selecionam módulos |
| Selector de módulos + total €/mês | New | Lê o catálogo público de preços; badge "14 dias grátis" |
| `FirstValueChecklist` (Dashboard) | New | Checklist por vertical; dispensável; deep-links para as ações |
| `BillingBanner` | Modify | Novo estado `trial_expired` (vermelho, "fala connosco" + link Faturação) |
| `Faturacao.tsx` | Modify | Estado `trial_expired` (aviso + CTA contacto/suporte) |
| `AdminBilling.tsx` | Modify | Ação **"Estender trial"** por tenant + origem "self-serve" visível |
| `billingStatus.ts` | Modify | Labels/badges do novo reason `trial_expired` |
| API `POST /users/signup` | New | Público; zod; rate-limited; anti-enumeração |
| API `GET /billing/catalog` (público) | New | Preços para o signup (só module/label/€/ativo — sem dados sensíveis) |
| API `PATCH /admin/billing/subscriptions/:userId/trial` | New | Estender trial (dono) |
| `computeBillingAccess` | Modify | `trialing` + `trialEnd` no passado → `trial_expired` (read-only) |

## Key Interactions

- **Signup passo 1 → 2**: escolher vertical anima a pré-seleção de módulos; total €/mês atualiza em
  tempo real ao (des)marcar módulos; "Outro" abre a escolha manual sem pré-seleção.
- **Submeter**: sucesso mostra SEMPRE o mesmo ecrã "vê o teu email" (anti-enumeração — email já
  registado não revela nada no UI; o email enviado é que difere).
- **Link do email**: abre `SetupPassword` → definir password → login automático? **Não** — redirect
  para `/login` com mensagem de sucesso (mantém o fluxo existente; menos superfície nova).
- **1.º login**: Dashboard com `FirstValueChecklist` no topo (por vertical); cada item é deep-link
  (ex.: `/agenda` para criar serviço); itens completam-se sozinhos (derivados dos dados existentes);
  dispensável com persistência em localStorage.
- **Trial expirado**: write-guard já desativa CTAs (readOnly); banner vermelho `trial_expired`;
  Faturação explica e aponta para o suporte (chat já existe). Dono estende no Admin → tenant volta
  a `trialing` instantaneamente.

## Responsive Behavior

Signup mobile-first (o barbeiro chega pelo telemóvel): passos empilhados, cartões de vertical em grelha
2×2 → coluna; sticky do total €/mês no fundo em mobile. Checklist do Dashboard colapsa para acordeão
em `<md`.

## Accessibility Requirements

Formulários com labels reais + `aria-describedby` nos erros zod; foco gerido entre passos (focus no
heading do passo); cartões de vertical são radio group navegável por teclado; contraste AA nos badges
de preço; o ecrã "vê o teu email" anuncia via `role=status`.

## Out of Scope (v1 desta fase)

- Cartão no signup / Stripe checkout (liga quando `BILLING_LIVE=true` — Fase 3 do roadmap).
- Captcha (Turnstile) e blocklist de emails descartáveis — só se houver abuso real (rate-limit +
  verificação bloqueante chegam para v1).
- Provisionamento do site público/subdomínio no onboarding (Fase 2 do roadmap — onboarding conectado).
- Seed automático de CMS/Site no signup (fica lazy, via checklist).
- Self-serve de upgrade/downgrade de módulos pós-signup (o dono gere no Admin; Fase 3).
- Emails de ciclo de vida do trial (dia 10, dia 13 — Fase 3, dunning/lifecycle).
