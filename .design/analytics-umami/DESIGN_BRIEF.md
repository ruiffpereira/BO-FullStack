# Brief — Estatísticas automáticas via Umami (D5) · Fase 3B do ROADMAP-EXECUCAO

**Data:** 2026-07-09 · **Decisão:** D5 fechada pelo user — migrar o analytics multi-tenant para **Umami self-host**.
**Porquê:** a Sites API do Plausible é exclusiva do Enterprise cloud (verificado: `GET`/`POST /api/v1/sites` → 404
na instância CE `analytics.rufvision.com` + docs oficiais). Sem API de criação de sites não há provisioning
automático, e sem isso `/estatisticas` não pode sair do gate `VIEW_ADMIN` (self-serve exige zero passos manuais).

**Objetivo end-to-end:** tenant reclama subdomínio / publica o site → o website é criado no Umami sozinho →
o site publicado passa a medir visitas → a página Estatísticas do BO mostra os dados. Zero passos do dono.

---

## Estado atual (levantamento 2026-07-09, file:line verificados)

- `provisionPlausibleSite` — `API-FullStack/controllers/backoffice/analytics/analyticsController.ts:64-82`.
  No-op sem `PLAUSIBLE_PROVISION_KEY` (`src/config.ts:102`). Chamada em 2 sítios: `setSiteDomain`
  (`analyticsController.ts:239`) e `syncWebsiteDomain` no claim do subdomínio (`controllers/backoffice/website/siteController.ts:194`).
- Leitura de stats — `getSiteAnalytics` (`analyticsController.ts:113`): 4 chamadas Plausible v1
  (`/stats/aggregate`, `/stats/timeseries`, `/breakdown event:page`, `/breakdown visit:source`),
  `site_id = User.websiteDomain`. Estados de resposta: `{configured:false, reason:"no-plausible"|"no-domain"}`,
  erro nunca 5xx.
- **O site-engine NÃO injeta script de tracking nenhum** (`site-engine/app/layout.tsx` — gap confirmado).
  Os 3 sites standalone (gymnoprado/tifas/winterplateau) injetam Plausible via `src/lib/plausible.ts` próprio.
- BO: `useSiteAnalytics.ts` + `Estatisticas.tsx` falam SÓ com a nossa API (key nunca chega ao browser).

## Contrato da API do Umami (docs oficiais, verificado 2026-07-09)

- **Auth (self-host):** `POST /api/auth/login {username, password}` → `{token}` (JWT); enviar
  `Authorization: Bearer <token>`; `POST /api/auth/verify` valida. Sem API keys no self-host.
  → o cliente deve **cachear o token e re-login em 401** (lifetime não documentado).
- **Criar website:** `POST /api/websites {name, domain}` → `{id: <uuid>, ...}`.
  **Listar:** `GET /api/websites?search=<domain>` (usar para idempotência antes de criar).
- **Stats:** `GET /api/websites/:id/stats?startAt&endAt` (ms) → `{pageviews, visitors, visits, bounces, totaltime}` ·
  `GET .../pageviews?startAt&endAt&unit=day|hour&timezone=` → `{pageviews:[{x,y}], sessions:[{x,y}]}` ·
  `GET .../metrics?startAt&endAt&type=path|referrer` → `[{x,y}]`.
- **Script de tracking:** `<script defer src="{UMAMI_URL}/script.js" data-website-id="<uuid>">`.
  ⚠ O Umami identifica sites por **UUID**, não por domínio — é preciso guardar o id por tenant.

---

## Arquitetura da mudança

### 1. API (API-FullStack)
- **Envs novas (OPCIONAIS como conjunto, env-gated — mesma filosofia do Plausible/Sentry/Google; nunca default
  silencioso de valor):** `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD` em `src/config.ts` (bloco `umami`).
  Documentar como opcionais no `.env.example`/CLAUDE.md. Sem as 3 → funcionalidade Umami desligada.
- **Cliente Umami** `src/utils/umami.ts`: login lazy + cache do token em memória + retry único em 401;
  `ensureWebsite(name, domain) → id` (search-antes-de-criar, idempotente); `getStats/getPageviews/getMetrics`.
  Timeouts curtos; erros logados (não engolidos em silêncio — corrigir a dívida do provision atual), mas
  **nunca** rebentam o pedido principal.
- **Migração:** `Users.analyticsSiteId` STRING(36) nullable (UUID do website Umami). Migrations correm
  sozinhas no deploy (Coolify) — aditiva, segura.
- **Provisioning:** substituir `provisionPlausibleSite(host)` por `provisionAnalyticsSite(user, host)` nos
  MESMOS 2 call-sites: com Umami configurado → `ensureWebsite(businessName||host, host)` e grava
  `user.analyticsSiteId`; sem Umami → mantém o comportamento Plausible atual (no-op sem provision key).
  Fire-and-forget mantém-se, mas com log de sucesso/falha.
- **Leitura (`getSiteAnalytics`): resolução por tenant, com fallback legado.**
  - Se `user.analyticsSiteId` && Umami configurado → ler do Umami e **mapear para o MESMO shape de resposta
    de hoje** (contrato com o BO é INVARIANTE — `useSiteAnalytics`/`Estatisticas.tsx` não mudam):
    bounce_rate = `bounces/visits*100`; visit_duration = `totaltime/visits`; timeseries de `pageviews.sessions`
    ou `pageviews.pageviews` conforme o campo atual (verificar o shape exato no código antes de mapear);
    top páginas = `metrics?type=path`; origens = `metrics?type=referrer`.
  - Senão → caminho Plausible atual intacto (serve os 3 sites standalone legados com histórico).
  - Períodos: o BO envia `day|7d|30d|month|6mo` (sintaxe Plausible). Traduzir para `startAt/endAt` (ms) +
    `unit` + `timezone` preservando a semântica atual documentada (7d/30d terminam ontem; day/month incluem hoje).
  - Reason tokens `no-plausible`/`no-domain` mantêm-se (compat BO); `no-plausible` passa a significar
    "nenhum provider configurado".
- **Backfill:** `scripts/backfillUmami.ts` (padrão dos scripts existentes) — para cada `User` com
  `websiteDomain` real (não herdado/localhost), `ensureWebsite` + gravar `analyticsSiteId`. Idempotente.
- **Swagger:** `GET /analytics/site` não muda de shape → sem alteração. O payload público do site (ver 2.)
  ganha campo novo → atualizar o swagger/spec correspondente se estiver descrito. Regra Kubb: se o spec do
  backoffice mudar, `pnpm kubb:refresh` no BO + committar `spec.json`.

### 2. Renderer (site-engine)
- O payload público que o renderer já consome para montar o site por host passa a incluir, quando existir,
  `analytics: { websiteId, src }` (src = `${UMAMI_URL}/script.js`, montado no SERVIDOR da API — o renderer
  não ganha env nova; server-driven config, coerente com a regra "config por-tenant vive na BD").
- `app/layout.tsx`: injetar `<script defer src={analytics.src} data-website-id={analytics.websiteId}>` via
  `next/script` quando o payload o traz. **NUNCA** nas rotas `/preview*` (rascunho não é tráfego real) e
  nunca sem payload. Localhost: o próprio Umami ignora? NÃO assumir — simplesmente não injetar quando não
  há `analytics` no payload (um tenant sem provisioning não tem).
- Sem alterações aos 3 sites standalone (continuam Plausible até migração própria — fora deste âmbito).

### 3. Backoffice
- **Zero mudanças funcionais** (fala com a nossa API; contrato invariante). Verificar apenas que nenhum
  texto da página Estatísticas afirma "Plausible" de forma enganadora para tenants Umami — se houver,
  neutralizar o wording (PT).

## Segurança / regras do projeto
- Credenciais Umami só no servidor; o browser só vê o `websiteId` (público por natureza — vai no HTML) e o src.
- Isolamento: `analyticsSiteId`/`websiteDomain` sempre do `req.user` — nunca aceitar site id do cliente.
- Zod em qualquer input novo (o PUT do domínio já valida).
- Testes: integração na API com Umami **mockado** (padrão do Stripe mockado) — provisioning idempotente,
  mapeamento de stats, fallback Plausible, isolamento; e2e do renderer não obrigatório nesta fatia.
- Atualizar `CLAUDE.md` (API + workspace + site-engine) e `FUNCIONALIDADES.md` (que hoje afirma,
  erradamente, que "os sites públicos injetam o script" — corrigir para a realidade nova).

## Fora de âmbito (desta fatia)
- Migrar gymnoprado/tifas/winterplateau para Umami (ficam no Plausible legado).
- Desligar/limpar o Plausible (só depois do backfill + migração dos standalone).
- Provisionamento no signup (Fase 5 do onboarding conectado) — os hooks atuais (claim/PUT) cobrem o fluxo.

## Critério de aceitação (gate)
1. Com Umami configurado (mock nos testes): claim de subdomínio → website criado no Umami + `analyticsSiteId`
   gravado; `GET /analytics/site` devolve dados mapeados do Umami no shape atual.
2. Sem Umami configurado: comportamento de hoje intacto (Plausible legado + reasons).
3. Site publicado pelo renderer contém o script do Umami com o UUID certo; `/preview` não contém.
4. `tsc` + testes API verdes; docs atualizadas.
