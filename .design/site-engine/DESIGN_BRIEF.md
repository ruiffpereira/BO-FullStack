# Design Brief: Site Engine (renderer multi-tenant composável)

_Decisões travadas no `grill-me` (2026-07-01). Este brief formaliza e detalha; supersede/detalha o **D3 + Fase 4 + #11** do [ROADMAP.md](../../../ROADMAP.md)._

## Problem

Cada cliente da plataforma quer um website — e hoje cada site é **um código separado** (winterplateau em Astro, tifas/gymnoprado/margarida/rita/jrcars… em Vite+React, dezenas de pastas). Consequências que o dono sente na pele:
- **Um bug corrige-se N vezes** (ex.: o scroll do PWA teve de ser pensado site a site). Não escala.
- **Cada site novo é trabalho manual do zero** — trava o self-serve e a escala de aquisição.
- O design "à medida" por cliente vira **dívida técnica por cliente**.

A frustração humana do dono: *"todos os meus clientes vão querer site, e eu não posso manter um código por cada um."*

## Solution

**UM** renderer multi-tenant (Next.js, SSR/ISR) que resolve o cliente pelo **subdomínio** e **monta** o site a partir de uma **biblioteca curada de blocos** (peças de Lego), tematizada por cliente com **design tokens**. O conteúdo vem do **CMS que já existe** (multilíngua); a **estrutura** da página vive num **"Site JSON" por `userId`**. Os blocos são **funcionais** — ligam às APIs reais (marcar, comprar, inscrever no ginásio), não são panfletos.

No v1, o cliente **escolhe um template** (por vertical) + a **sua marca** (cor/fonte/logo) e fica **live em minutos**. O **editor visual block-based** (guard-rails, no backoffice com preview live) entra **na fase seguinte**, por cima da mesma fundação.

Porque é *um só código*, **corrige-se uma vez e todos os sites ficam curados** — e uma feature nova fica disponível para todos.

## Experience Principles

1. **Curadoria acima de liberdade** — o cliente combina peças testadas (Lego), nunca desenha do zero (Photoshop). Resolve a tensão *poder-do-cliente vs manutenível*: a liberdade é escolher template, variante e marca — não inventar layouts. Se um cliente precisa de algo, vira um **bloco/variante reutilizável**, nunca código só dele.
2. **O site trabalha, não decora** — cada bloco relevante liga à plataforma (marcar/comprar/inscrever). Resolve *site-builder genérico vs diferenciador*: o valor é o site ser a **frente viva do negócio**.
3. **Live em minutos, aprofundar depois** — template + marca primeiro; composição/edição fina a seguir. Resolve *rápido vs poderoso*: o cliente tem valor no dia 1 e o poder cresce por fases, sobre a mesma base.

## Aesthetic Direction

> **Nota:** o engine **não tem um visual único** — renderiza a marca de *cada* tenant. A "estética" é a **qualidade do sistema de blocos**: neutros, token-driven, que ficam bem em qualquer tema.

- **Philosophy**: **Editorial + Sistema** — blocos de qualidade editorial (tipografia forte, espaço, ritmo) construídos como sistema token-driven, para que qualquer paleta/fonte de cliente fique bem sem retoques.
- **Tone**: profissional, confiável, "feito à medida" — apesar de ser montado de peças.
- **Reference points**: templates Framer/Webflow de alta qualidade, temas Astro premium, o próprio winterplateau (barra alta de qualidade já atingida à mão).
- **Anti-references**: sites Bootstrap genéricos, "AI-slop" (gradiente roxo + Inter + grelha de cartões previsível), e o oposto — canvas livre que degrada por cliente.

## Existing Patterns (a reutilizar, não substituir)

- **CMS** (`sections` + `entries`: `key`/`locale`/`value`/`type`, contextos `website`/`product`/`service`/`gym`): **é a fonte de conteúdo dos blocos**. Import por CSV (`content-import.csv`) já existe; `winterplateau/content-import.csv` é a referência (nav, hero, produtos, projetos+SEO, 3 línguas).
- **Tokens**: `--accent` (CSS var) + Tailwind config no Backoffice — base para o **sistema de tokens por tenant**.
- **APIs públicas** (o "funcional" dos blocos): `/api/websites/booking`, `/api/websites/ecommerce`, `/api/websites/gym`, `/api/websites/customers`, + conteúdo CMS. `authenticateTokenPublic` (identidade opcional).
- **Sites atuais = matéria-prima dos blocos**: winterplateau (`Nav, Hero, About, Statement, Stats, Marquee, Obras, Testemunhos, CtaBand, Downloads, Orcamento, Contact, Footer`, produtos, Projetos/Projeto) e tifas (`Navbar, Hero, BookingWidget, Gallery, conta do cliente, CookieConsent, LanguageSwitcher, PwaInstall`).
- **Princípio de config** (manter): plataforma → **env** (domínio wildcard, SSL, deploy Next); tenant → **BD por `userId`** (Site JSON, tema, domínio, CMS).

## Arquitetura (o "como", em resumo)

- **Renderer (Next.js, SSR/ISR):** middleware resolve o **tenant pelo hostname** (`cliente.plataforma.pt`) → carrega **Site JSON** (API) + **tokens do tema** + **conteúdo CMS** (locale) → renderiza os blocos da **biblioteca partilhada** → **cache ISR por (tenant, página, locale)**, revalidada no *publish*. Mata os `.env` por-site (domínio vem do pedido).
- **Biblioteca de blocos:** **um** pacote de componentes **React**, token-driven (CSS vars), consumido pelo renderer (SSR) **e** (fase 2) pelo preview do editor — mesma peça nos dois sítios (DRY).
- **Tema por tenant:** conjunto de tokens (paleta, escala tipográfica, raio, espaçamento, fontes) guardado por `userId`, injetado como CSS vars na raiz. **V1: presets curados de paleta + escolha de accent + par de fontes** (não color-picker livre — protege a qualidade).
- **Site JSON** (novo modelo, por `userId`): estrutura da página. Conteúdo por **referência ao CMS** (multilíngua); blocos funcionais têm um *binding* a uma API.

### Schema proposto do Site JSON
```jsonc
{
  "tenantId": "<userId>",
  "domain": { "subdomain": "cliente", "customDomain": null },
  "theme": { "preset": "slate", "accent": "#2A6FDB", "fontPair": "grotesk-serif" },
  "nav": { "logoRef": "cms:brand.logo", "links": [{ "labelRef": "cms:nav.services", "to": "/servicos" }], "cta": { "type": "booking" } },
  "pages": [
    { "slug": "/", "seoRef": "cms:seo.home", "blocks": [
      { "id": "b1", "type": "hero", "variant": "split", "contentRef": "cms:hero", "settings": { "bg": "muted" } },
      { "id": "b2", "type": "booking", "variant": "inline", "data": { "source": "booking", "serviceId": null } },
      { "id": "b3", "type": "gallery", "variant": "masonry", "contentRef": "cms:gallery" }
    ]}
  ],
  "footer": { "contentRef": "cms:footer" }
}
```

## Component Inventory — biblioteca de blocos v1

| Bloco | Estado | Liga a | Variantes (curadas) |
|---|---|---|---|
| **Nav** | Novo (de winter/tifas) | CMS + logo | padrão / transparente-sobre-hero / centrada |
| **Hero** | Novo | CMS | centrado / split-imagem / full-bleed |
| **About / Statement** | Novo | CMS | texto+imagem / só texto editorial |
| **Stats** | Novo (winter `Stats`) | CMS | 3-col / faixa |
| **Services grid** | Novo | CMS **ou** serviços da agenda | grelha / lista |
| **Gallery** | Novo (winter `Obras` / tifas `Gallery`) | CMS/uploads | grelha / masonry / carrossel |
| **Portfolio/Obras (+detalhe)** | Novo (winter `Projetos/Projeto`) | CMS | grelha + página de detalhe |
| **Testimonials** | Novo | CMS (+ Google Reviews) | carrossel / grelha |
| **Pricing / Planos** | Novo | CMS **ou** subscrições do ginásio | cartões / tabela |
| **FAQ** | Novo | CMS | acordeão |
| **CTA band** | Novo (winter `CtaBand`) | CMS + ação | simples / com imagem |
| **Contact + Mapa** | Novo (winter `Contact`) | CMS | form+mapa / só form |
| **Footer** | Novo | CMS | completo / minimal |
| **Cookie/Privacidade** | Existe (3 sites) | CMS (`cookies.*`, `/privacidade`) | — (RGPD, obrigatório) |
| **Language switcher** | Existe (tifas) | settings de línguas | — |
| — **FUNCIONAIS** — | | | |
| **Booking widget** | Novo (tifas `BookingWidget`) | `/websites/booking` | inline / modal / página |
| **Products + carrinho** | Novo (winter produtos) | `/websites/ecommerce` | grelha / destaque / categorias |
| **Gym signup / sócio** | Novo | `/websites/gym` | inscrição / CTA-PWA |
| **Lead / Orçamento** | Novo (winter `Orcamento`) | `/websites/customers` | form → cria lead/cliente |
| **Conta do cliente / login** | Novo (tifas dashboard) | `/websites/customers` | — |

**Engine (não-blocos):** Renderer Next.js · resolução por hostname · loader de Site JSON/tema/CMS · cache ISR · provisão de subdomínio · (fase 2) editor block-based + preview iframe.

## Templates por vertical (v1 — "escolhe o teu site")

| Template | Blocos iniciais |
|---|---|
| **Barbeiro/Salão** (agenda) | Nav · Hero(split) · Services · **Booking** · Gallery · Testimonials · Contact · Footer |
| **Ginásio** (wedge) | Nav · Hero(full-bleed) · **Planos**(subscrições) · **Gym signup** · Services/Aulas · Testimonials · Contact · Footer |
| **Loja** (ecommerce) | Nav · Hero · **Products** · Categorias · Destaques · CTA band · Contact · Footer |
| **Serviços/Genérico** | Nav · Hero(centrado) · About · Services · Testimonials · CTA band · Contact · Footer |

## Key Interactions

- **Escolher o site (v1):** no backoffice → galeria de **templates por vertical** (preview) → escolhe → escolhe **marca** (preset de paleta + accent + par de fontes + logo) → **provisiona subdomínio** → site **live** (SSR). Sem código.
- **Editar conteúdo (v1):** pelo **CMS** que já existe (texto/imagens dos blocos por `key`+locale). Multilíngua resolvido na locale do visitante.
- **Blocos funcionais:** "Marcar" abre o fluxo real de booking; "Produtos" tem carrinho real; "Inscrever" liga ao ginásio — tudo via APIs públicas + `authenticateTokenPublic`.
- **Publish → cache:** guardar/publicar revalida o ISR daquele tenant/página/locale (o site atualiza sem rebuild global).
- **(Fase 2) Editor block-based:** add/remover/reordenar blocos, trocar **variante**, editar conteúdo/tokens — **no backoffice com preview live em iframe**; nunca canvas livre.

## Responsive Behavior

- **Mobile-first obrigatório** em todos os blocos (a maioria do tráfego dos sites de negócio é telemóvel). Cada bloco define o seu comportamento (não só encolher: nav → menu, grelhas → 1 coluna, carrosséis → swipe).
- Herda as lições do PWA recém-corrigido: viewport real, sem rubber-band, alvos ≥44px.

## Accessibility Requirements

- Contraste **AA** garantido **pelo sistema de tokens** (validar cada preset de paleta claro/escuro).
- Navegação por teclado + foco visível em todos os blocos interativos (nav, booking, carrinho, forms).
- HTML semântico (landmarks `header`/`main`/`nav`/`footer`, headings em ordem), imagens com alt (do CMS), `prefers-reduced-motion` respeitado.
- **RGPD**: cookie consent + página `/privacidade` por tenant (já resolvido nos sites atuais; portar como blocos).

## Faseamento (v1 → editor)

1. **Biblioteca de blocos v1** — extrair ~14 blocos + 2–3 variantes de winter/tifas, token-driven. _(fundação)_
2. **Renderer Next.js** — resolução por hostname + loader (Site JSON/tema/CMS) + ISR. API para servir o Site JSON. Seed dos 4 templates.
3. **Backoffice: picker + marca + subdomínio** — cliente vai live com template + tema. _(fim do v1)_
4. **Editor block-based** (fase 2) — no backoffice, preview iframe.
5. **Depois** — domínios próprios, mais blocos/variantes, **migrar tifas** como prova.

## Out of Scope (v1)

- **Editor visual** — fica para a fase 2 (v1 = templates + tema + CMS).
- **Domínios próprios** — subdomínio primeiro; custom domain (CNAME + SSL) depois.
- **Migrar os sites atuais** — winterplateau/tifas/etc. ficam como estão; migrar 1 depois, como prova.
- **Color-picker/fontes livres** — v1 usa presets curados (protege qualidade); controlo fino no editor (fase 2).
- **Billing/planos da plataforma** — decisão de dinheiro é separada (ver ROADMAP D1).
- **Marketplace de templates / temas por IA** — futuro.
