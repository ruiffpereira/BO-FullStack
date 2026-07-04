# Design Brief: T19 — Onboarding Conectado (signup → site rascunho)

> Fase 2 do [ROADMAP-EXECUCAO.md](../../../ROADMAP-EXECUCAO.md). Decisão do user (2026-07-04):
> **abordagem = unificar os templates num endpoint da API** (fonte única). Construção por agentes
> (Sonnet) + review adversarial, commits locais. Liga [[project-self-serve]] a [[project-site-engine]].

## Problem

Hoje, quando um cliente faz signup self-serve e escolhe a sua vertical (barbearia/ginásio/loja/outro),
a conta é criada mas **o site público nasce vazio** — o tenant tem de ir à página Website e escolher um
template à mão. Além disso, os 4 templates de site vivem **só no Backoffice** (`src/lib/siteTemplates.ts`,
~400 linhas com conteúdo inline), o que impede a API de os usar para semear e cria duas potenciais fontes
de verdade se algum dia a API precisar deles.

## Solution

Ao fazer signup, o tenant fica logo com um **site rascunho pré-preenchido pela sua vertical**, pronto a
personalizar e publicar. Para isso, os 4 templates passam a ser **fonte única na API**, expostos por um
endpoint; o **signup semeia** um `Site` rascunho a partir do template da vertical; e o **picker do
Backoffice consome esse endpoint** em vez da constante local (fim da duplicação).

## Experience Principles

1. **Chegar com valor, não com uma folha em branco** — o site já existe e tem conteúdo de arranque.
2. **Uma fonte de verdade** — os templates vivem num sítio (API); o BO e o signup consomem o mesmo.
3. **Não-destrutivo** — semear nunca pisa um site que o tenant já tenha começado.

## Existing Patterns (a respeitar/estender)

- **Backoffice** `src/lib/siteTemplates.ts` — `SITE_TEMPLATES` (barber/gym/loja/generic), cada um um
  `SiteUpsert` completo (theme+nav+pages+blocks+footer, conteúdo PT inline). Alimenta o `TemplateTab` do
  `Website.tsx` (picker) via `useSaveSite().mutate(t.site)`.
- **API** `models/site.ts` (1 Site por `userId`, colunas JSON theme/nav/pages/footer, `template`,
  `published`), `controllers/backoffice/website/siteController.ts` (getSite/putSite lazy findOrCreate),
  `controllers/backoffice/admin/signupController.ts` (`finishSignupInBackground` — cria User+role+
  PlatformSubscription; **nunca toca no Site** hoje; já tem o campo `vertical` do signup: barber|gym|shop|other).
- **Mapeamento vertical→template a resolver:** `shop`≠`loja`, `other`≠`generic`.
- **Kubb everywhere** (BO consome só hooks gerados), **zod** nos inputs, **sem env defaults**, PT na UI.

## Component Inventory

| Peça | Estado | Notas |
|------|--------|-------|
| API: templates server-side | New | Portar `siteTemplates.ts` para a API (fonte única) + mapa vertical→template |
| API: `GET /api/website/templates` | New | Lista de templates (authenticateToken); o BO consome |
| API: seed no signup | Modify | `finishSignupInBackground` cria Site rascunho da vertical (findOrCreate, fire-and-forget, não-destrutivo, `published:false`) |
| BO: `TemplateTab` picker | Modify | Consome `GET /website/templates` em vez da constante local; remover/deprecar `siteTemplates.ts` |
| Kubb | Modify | Regenerar (novo endpoint) |

## Key Interactions

- Signup conclui → em background, a API semeia o `Site` do tenant a partir do template da vertical
  (se ainda não existir Site). Falha do seed **nunca** parte o signup.
- Tenant entra → a página Website já mostra o site rascunho da vertical; o `FirstValueChecklist` pode
  apontar "revê e publica o teu site".
- No picker, trocar de template continua a funcionar (agora vindo do endpoint), com a confirmação de
  sobreposição já existente.

## Accessibility / Responsive

Sem UI nova significativa (o picker já existe); manter o comportamento atual. Endpoint é dados.

## Out of Scope

- Provisionar subdomínio/publicar automaticamente no signup (fica para o "onboarding conectado" pleno /
  Fase 5 — aqui só se cria o **rascunho**).
- Seed de conteúdo CMS por vertical (`ContentEntry`) — o conteúdo inline dos templates chega para o v1.
- Alterar o modelo `Site` (a estrutura atual já encaixa).
- Migrar tifas / T28 review visual (itens à parte da Fase 2).
