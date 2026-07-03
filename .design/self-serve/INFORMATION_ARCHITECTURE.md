# Information Architecture: Self-Serve Signup & Activation

Base: [DESIGN_BRIEF.md](DESIGN_BRIEF.md). Estende a estrutura existente do Backoffice (React Router
em `App.tsx`, páginas standalone `Login`/`SetupPassword` fora do `Shell`).

## Site Map

- Login `/login` *(existe)*
  - **Signup `/signup`** *(novo, público, standalone como o Login)*
    - Passo 1 — negócio: nome do negócio + email + vertical (radio cards)
    - Passo 2 — plano: módulos (pré-seleção pela vertical) + total €/mês + «14 dias grátis» → submeter
    - Estado — «vê o teu email» (mesmo URL, estado interno; anti-enumeração)
  - Setup password `/setup-password?token=` *(existe — reutilizado como verificação de email)*
- Dashboard `/` *(existe)*
  - **FirstValueChecklist** *(novo bloco no topo, por vertical, dispensável)*
- Faturação `/faturacao` *(existe — ganha estado `trial_expired`)*
- Admin `/admin` → tab Faturação *(existe — ganha ação «Estender trial»)*

## Navigation Model

- **Sem alteração à navegação principal** (Shell/sidebar intactos).
- Entradas para o signup: link «Criar conta» no `Login.tsx` (único ponto interno); URL direto
  partilhável (`/signup`) para marketing/passa-palavra.
- O `/signup` liga de volta ao `/login` («Já tens conta? Entrar»).
- Mobile: passos empilhados; total €/mês sticky no fundo do passo 2.

## Content Hierarchy

### /signup — passo 1
1. Título + proposta («A tua app de gestão — 14 dias grátis, sem cartão») — decide o tom em 2s
2. Vertical (radio cards com ícones: Barbearia/Salão · Ginásio · Loja · Outro) — a decisão que molda o resto
3. Nome do negócio + email — o mínimo para criar conta
4. Link «Já tens conta?»

### /signup — passo 2
1. Módulos com preço (pré-marcados pela vertical) — a única decisão real
2. Total €/mês + selo «primeiros 14 dias grátis, sem cartão» — transparência
3. CTA «Criar conta» + nota legal curta (termos/RGPD)

### Dashboard (1.º login)
1. `FirstValueChecklist` (topo, acima da espinha atual) — o caminho para o valor
2. Espinha vertical-aware existente — intacta

## User Flows

### Signup → primeiro valor
1. Visitante abre `/signup` (link do Login ou URL direto)
2. Passo 1: escolhe vertical, preenche nome do negócio + email
3. Passo 2: ajusta módulos (total atualiza), clica «Criar conta»
   - API cria User (sem password, com setupToken) + role por-tenant (componentes dos módulos) +
     PlatformSubscription local `trialing` (trialEnd = +14d, modules, monthlyTotalCents do catálogo)
   - Notifica o dono (`notifyUser` → admins)
   - **Email já existe** → resposta é o MESMO sucesso genérico; o email enviado diz «já tens conta,
     entra aqui / recupera a password» (anti-enumeração)
4. Ecrã «vê o teu email» (role=status)
5. Clica o link → `/setup-password?token=` → define password (token single-use, 24h)
6. Redirect para `/login` com sucesso → entra
7. Dashboard mostra `FirstValueChecklist` da vertical:
   - Agenda: criar 1 serviço → definir horário → (partilhar link de marcação)
   - Ginásio: criar 1 subscrição → adicionar 1 cliente → registar 1 cobrança
   - Loja: criar 1 produto → (rever encomendas)
   - Outro/core: adicionar 1 cliente → explorar conteúdos
8. Itens completam-se sozinhos ao existirem dados; checklist dispensável (localStorage)

### Trial expira (sem cobrança real ativa)
1. `trialEnd` passa → `computeBillingAccess` devolve `trial_expired` (readOnly)
2. Write-guard desativa CTAs de escrita; `BillingBanner` vermelho («O teu período experimental
   terminou — fala connosco»); Faturação explica + aponta ao chat de suporte
3. Dono vê o tenant no Admin→Faturação (badge `trial_expired`) → «Estender trial» (+N dias)
4. Tenant volta a `trialing` no próximo fetch — sem re-login

### Token expirado/reutilizado
1. `/setup-password` com token inválido → erro claro + CTA «reenviar email» → novo endpoint público
   de re-envio (rate-limited, anti-enumeração: responde sempre sucesso)

## Naming Conventions

| Conceito | Label na UI | Notas |
|----------|-------------|-------|
| Trial | «período experimental» / selo «14 dias grátis» | nunca "trial" em PT na UI |
| Vertical | «tipo de negócio» | Barbearia/Salão · Ginásio · Loja · Outro |
| Módulo | «módulo» (Agenda · Ginásio · Loja) | consistente com Admin/Faturação |
| trial_expired | «período experimental terminado» | badge vermelho, tom não-punitivo |
| Signup | «Criar conta» | CTA e link do Login |

## Component Reuse Map

| Component | Usado em | Diferenças |
|-----------|----------|------------|
| Esqueleto standalone do `Login.tsx` | `/signup` | 2 passos + estado email |
| `SetupPassword.tsx` | verificação de email | zero alterações (copy já serve) |
| `Card`/`Button`/`Input`/`Badge` (ui.jsx) | signup, checklist | — |
| `BillingBanner` | trial_expired | novo ramo de estado |
| `AdminBilling` tabela | «Estender trial» | nova ação por linha |
| `MODULE_LABELS`/formatos (`billingStatus.ts`) | signup passo 2 | reutilizados no público |

## Content Growth Plan

Verticais novas (ex.: clínicas) = novo radio card + mapping vertical→módulos (constante única
partilhada); checklist por vertical é um map extensível. O catálogo de preços já é dinâmico (BD).

## URL Strategy

- `/signup` — sem sub-rotas; passos são estado interno (evita deep-link para passo 2 sem passo 1).
- `/setup-password?token=` — existente, inalterado.
- Query `?vertical=gym|barber|shop` opcional no `/signup` (pré-seleciona a vertical — para links de
  marketing dirigidos), ignorada se inválida.
- API: `POST /users/signup` · `POST /users/signup/resend` · `GET /billing/catalog` (público) ·
  `PATCH /admin/billing/subscriptions/:userId/trial`.
