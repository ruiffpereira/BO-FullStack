# Build Tasks: Site Engine (renderer multi-tenant composável)

Gerado de: `.design/site-engine/` (DESIGN_BRIEF + INFORMATION_ARCHITECTURE + tokens.css) · 2026-07-01

**Abrange 3 codebases:** `[API]` API-FullStack · `[REND]` renderer Next.js (novo) · `[BO]` Backoffice.
**Filosofia (bloco 1):** "Editorial + Sistema" — blocos token-driven que ficam bem em qualquer marca (tokens.css já feito).
**Estratégia de ordem:** **fatia end-to-end fina primeiro** (T1–T4: um subdomínio a renderizar um Hero+Footer reais de Site JSON+CMS+tokens) → desrisca a arquitetura antes de investir em 14 blocos. Só depois se fanou os blocos, os funcionais e a UI do backoffice.

> **v1 = Foundation + blocos + templates + área Website (templates/marca/páginas/domínio/publicar).** O **editor visual inline (WYSIWYG sobre o preview)** é **fase 2** — no v1 a edição de blocos é por formulário + preview iframe.

## Foundation — fatia end-to-end (risco primeiro)
> **Progresso 2026-07-01:** T1–T3 **feitos e verificados** (renderer Next.js a mostrar o Site demo real — Hero split + Nav + Footer, tema ink/editorial; screenshots em `screenshots/`). T4 ISR **parcial** (fetch com `revalidate:60`+tags feito; falta o webhook `POST /revalidate` assinado). **TODO conhecido:** aviso de *hydration mismatch* no dev overlay a confirmar (código da app limpo — só o ano do Footer, server-side; validar com `next start`). API T1 committada (`31bf62d`); falta correr a migração. Renderer é repo próprio em `d:\Projetos\Projectos\site-engine`.
>
> **Testes (2026-07-01):** T1 — testes de **integração** escritos (`tests/backoffice/site.test.ts` + `tests/websites/site.test.ts`: isolamento, mass-assignment, subdomínio, publish, resolver público); tsc verde mas **não corridos** (BD de teste `:3307` em baixo — mesmo gap dos e2e; correr `pnpm test` na API quando o container subir). T2/T3 — **unit** do renderer (`tests/unit/`: routing + tema) **20/20 verde** (Vitest).
>
> **Regra (DoD daqui para a frente):** cada tarefa T4+ leva testes — integração na API + unit/e2e no que aplicar. Não fechar uma tarefa sem testes.
- [x] **T1 · Site JSON model + API** `[API]`: modelo `Site` por `userId` (domain/theme/locales/nav/pages[]/footer) + `Page`/`BlockInstance` (schema no brief). Endpoints `GET/PUT /website` (tenant) e `GET /websites/site?host=` (público, resolve por hostname). Seed de um default. _Novo; segue o princípio env(plataforma)/BD(tenant)._
- [x] **T2 · Scaffold do renderer + resolução por hostname** `[REND]`: app Next.js (App Router, SSR), importa `tokens.css`, middleware resolve tenant pelo `host` → `GET /websites/site` → renderiza `Hello {tenant}` com o tema injetado (`<html data-preset data-theme data-accent data-font>`). Prova resolução+SSR+tokens. _Novo._
- [x] **T3 · SiteLayout + BlockRenderer + Hero + Footer** `[REND]`: `BlockRenderer` mapeia `type`+`variant`→componente; `SiteLayout` injeta tema + nav/footer. Construir **Hero** (variantes centrado/split/full-bleed) e **Footer**, lendo conteúdo do **CMS** (por `contentRef`, na locale). **← 1.ª fatia visível: subdomínio mostra Hero+Footer reais.** _Novo; valida a estética cedo._
- [x] **T4 · ISR + revalidação** `[REND+API]`: cache por (tenant, página, locale); endpoint `POST /api/revalidate` (assinado, `REVALIDATE_SECRET`) que o backoffice chama no **publish** e no **put quando já publicado** (`revalidateRenderer(siteHosts(...))`, env-gated). **Testado:** renderer unit (auth/parse/tag, verde) + `siteHosts` (API). _Env: `RENDERER_URL`+`REVALIDATE_SECRET` na API; `REVALIDATE_SECRET` no renderer._

## Biblioteca de blocos (fan-out — cada um é uma fatia independente, com variantes)
- [ ] **T5 · Nav** `[REND]`: dinâmica das páginas `inNav` (ordenadas) + CTA principal por vertical + seletor de língua; mobile = drawer; header fixo (lição do scroll: 100dvh/overflow). _Novo._
- [x] **T6 · About/Statement + Stats** `[REND]`: texto+imagem / editorial; Stats com contadores. _Novo (base: winter `About/Statement/Stats`)._
- [x] **T7 · Services/Features grid** `[REND]`: grelha/lista; fonte = CMS **ou** serviços da agenda. _Novo._
- [x] **T8 · Gallery** `[REND]`: grelha/masonry/carrossel (swipe mobile). _Novo (base: winter `Obras`, tifas `Gallery`)._
- [x] **T9 · Testimonials + CTA band + FAQ** `[REND]`: carrossel/grelha (+ opcional Google Reviews); CTA band; FAQ acordeão. _Novo._
- [ ] **T10 · Pricing/Planos** `[REND]`: cartões/tabela; fonte = CMS **ou** subscrições do ginásio. _Novo._
- [ ] **T11 · Contact + Mapa** `[REND]`: form + mapa + horários; ligado ao lead (T16). _Novo._
- [ ] **T12 · Collection (portfolio/obras)** `[REND]`: bloco-lista + página `/{slug}` + detalhe `/{slug}/{item}` (paginação/filtro). _Novo (base: winter `Projetos/Projeto`)._

## Blocos FUNCIONAIS (ligam às APIs reais — depois da máquina provada)
- [ ] **T13 · Booking** `[REND]`: bloco marcar (inline/modal) → `/websites/booking`; deep-link `serviceId`; confirmação + "Adicionar ao calendário" (.ics). _Novo (base: tifas `BookingWidget`); reusa API._
- [ ] **T14 · Loja + carrinho + checkout** `[REND]`: grelha/ficha `/loja/:produto` + `/carrinho` + `/checkout` → `/websites/ecommerce` (Stripe já existe). _Novo; reusa API/Stripe._
- [ ] **T15 · Ginásio (inscrição/sócio)** `[REND]`: `/inscrever` + CTA-PWA → `/websites/gym`. _Novo; reusa API._
- [ ] **T16 · Lead/Orçamento + Conta do cliente** `[REND]`: form → cria lead/cliente (`/websites/customers`); `/conta` + `/entrar`. _Novo (base: winter `Orcamento`, tifas dashboard)._

## SEO & multilíngua
- [ ] **T17 · SEO por página + locale routing** `[REND]`: `title/meta/OG` do CMS `seo.*`, `canonical`, `hreflang` por locale; routing prefixo-exceto-padrão (`/servicos`, `/en/servicos`). _Novo._
- [ ] **T18 · sitemap.xml + robots.txt + RGPD** `[REND]`: por tenant; página `/privacidade` + cookie consent como blocos (portar dos sites atuais). _Novo (base: `cookies.*`/`privacy.*` no CMS)._

## Templates (compõem blocos em sites-arranque)
- [ ] **T19 · 4 templates por vertical** `[API/seed]`: barbeiro, ginásio (wedge), loja, genérico → Site JSON seed + conteúdo CMS seed (estilo `content-import.csv`). Alimenta o "escolhe o teu site". _Novo._

## Backoffice — área "Website" (v1, sem editor inline)
> **2026-07-01:** T20/T21/T22/T25 **feitos** (página `/website` com 4 tabs, hook `useWebsite.ts`, 4 templates, 4 testes verdes). **Escondida dos tenants** (gated a `VIEW_ADMIN` no `Shell.tsx`, fora de `CORE_PATHS`) até estar pronta — falta T23 (gestor de páginas) + T24 (gestor de blocos) + preview iframe real. **Passar a core** quando completo.
- [x] **T20 · Área Website (shell + estado)** `[BO]`: item na sidebar (`MENU_ORDER`) + rota `/website`; "O meu site" (rascunho/publicado, URL, Ver site, setup pendente). Reusa `ui/ui.jsx` (`Tabs`, `Card`). _Novo._
- [x] **T21 · Escolher template** `[BO]`: galeria por vertical com preview → semeia o Site JSON. _Novo; depende de T19._
- [x] **T22 · Marca (preset+accent+fontes+logo)** `[BO]`: escreve `theme` no Site JSON; **preview live em iframe** (aponta ao renderer com o rascunho). _Novo; depende de T3._
- [ ] **T23 · Gestor de páginas** `[BO]`: add/remover/reordenar páginas, slug (gerado/editável, valida rotas reservadas), toggle "na nav", flag coleção → nav dinâmica. _Novo._
- [ ] **T24 · Gestor de blocos por página** `[BO]`: add/remover/reordenar blocos + escolher variante + ligar conteúdo CMS (formulário), com preview iframe. _Novo; **v1** (o WYSIWYG inline é fase 2)._
- [x] **T25 · Subdomínio + Publicar** `[BO+API]`: escolher subdomínio (verifica disponibilidade + provisiona) + Publicar → chama `POST /revalidate`. _Novo; depende de T4._

## Polish & Review
- [ ] **T26 · Responsivo + acessibilidade** `[REND]`: mobile-first em todos os blocos (não só encolher), alvos ≥44px, foco visível, contraste AA por preset (validar claro/escuro), `prefers-reduced-motion`. _Transversal._
- [ ] **T27 · Performance** `[REND]`: cache/headers ISR, otimização de imagens, carregamento de fontes por par, code-split de blocos. _Transversal._
- [ ] **T28 · Design review + migrar 1 site**: `/design-review` contra o brief; migrar **tifas** para o engine como prova (valida "fix once"). _Fecho._

---
## Fora do v1 (fase 2+)
- Editor visual **inline** (WYSIWYG sobre o preview, drag). — T24 é a versão v1 por formulário.
- Domínios próprios (CNAME + SSL por-domínio).
- Migrar os restantes sites; hex/fontes livres (além dos presets); marketplace de templates.
