# Build Tasks: T19 — Onboarding Conectado (signup → site rascunho)

Generated from: .design/t19-onboarding/DESIGN_BRIEF.md
Date: 2026-07-04 · Execução: agentes Sonnet + review adversarial por fatia; commits locais → push.
Decisão: **templates = fonte única na API + endpoint + signup semeia + picker do BO consome.**

## Foundation (API — fonte única dos templates)
- [x] **T1 — Templates server-side (fonte única)**: portar os 4 templates de vertical
  (`barber`/`gym`/`loja`/`generic`) de `Backoffice/src/lib/siteTemplates.ts` para a API
  (ex.: `src/data/siteTemplates.ts`), com a mesma estrutura `Site` (theme/nav/pages/blocks/footer,
  conteúdo PT inline) + um mapa **vertical→template** que resolve `shop→loja` e `other→generic`
  (barber→barber, gym→gym). Helper `getTemplateForVertical(vertical)` e `listTemplates()`. _New (port);
  fonte única a partir daqui._
- [x] **T2 — `GET /api/website/templates`**: endpoint (authenticateToken) que devolve `listTemplates()`
  (id/label/vertical + o payload `Site` de cada). @swagger. Sem dados sensíveis. _New endpoint (read-only);
  monta ao lado das rotas `/website` existentes._

## Core (API — semear no signup)
- [x] **T3 — Signup semeia o Site rascunho**: em `finishSignupInBackground` (`signupController.ts`), após
  criar tenant+role+subscrição, **findOrCreate** de um `Site` para o `userId` a partir de
  `getTemplateForVertical(vertical)` — `published:false`, **não-destrutivo** (não pisa um Site já
  existente), **fire-and-forget** (falha do seed nunca parte o signup). _Modify: signupController._
  Testes: signup de cada vertical cria o Site com o template certo; Site pré-existente não é sobreposto;
  isolamento (o Site é do `userId` do novo tenant); falha do seed não quebra o signup. _Depends on: T1._

## Core (BO — picker consome a fonte única)
- [x] **T4 — TemplateTab consome o endpoint**: o `TemplateTab` do `Website.tsx` passa a ler os templates
  de `GET /website/templates` (hook Kubb gerado) em vez da constante local `siteTemplates.ts`; aplicar um
  template continua a funcionar (`useSaveSite`) com a confirmação de sobreposição existente. Remover/deprecar
  `src/lib/siteTemplates.ts` (fim da duplicação). Kubb refresh. _Modify: Website.tsx; Depends on: T2._
  Testes unit: picker renderiza os templates do endpoint (mockado); aplicar chama `useSaveSite` com o
  payload certo; estados loading/erro.

## Review
- [x] **T5 — Review adversarial + design-review + commit/push**: Workflow/agente — isolamento do seed
  (Site sempre do `userId`), não-destrutividade, endpoint sem fugas, sem drift de templates (a constante
  do BO deixou de existir → fonte única confirmada). Aplicar findings via agente. Commit por fatia
  (API primeiro, BO depois) + push. Atualizar CLAUDE.md (API + BO) + FUNCIONALIDADES + este TASKS.

## Deferido (fora do T19 — ver Out of Scope do brief)
- Provisionar subdomínio/publicar automático no signup (Fase 5). · Seed de CMS por vertical. · T28 visual
  + migrar tifas.
