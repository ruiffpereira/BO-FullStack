# Information Architecture: Site Engine (renderer multi-tenant)

_Segue o [DESIGN_BRIEF.md](DESIGN_BRIEF.md). Decisões de IA travadas: **locale = prefixo exceto o padrão**, **páginas geríveis no v1** (add/remover/reordenar), **multi-página por defeito**._

> **Implicação de âmbito (importante):** "add/remover páginas no v1" **sem** o editor visual (fase 2) ⇒ o v1 traz um **gestor de páginas leve** no backoffice (CRUD de páginas + escolher que blocos entram + flag "na nav" + ordem). A **nav é dinâmica** (gerada pelas páginas), não fixa por template. A **edição visual dos blocos** (inline, drag) continua na **fase 2**.

---

## Site Map

O engine tem **dois mapas**: o **site público** (por-tenant, dinâmico) e as **vistas do tenant no backoffice**.

### A) Site público (por tenant, resolvido por hostname)
```
{subdomínio}.{plataforma}.pt            → tenant resolvido pelo hostname
  /                                     Home            (Site JSON: página slug="")
  /{slug}                               Página content  (sobre, servicos, contactos, …) — geríveis
  /{slug}                               Página collection (ex.: projetos) →
      /{slug}/{item-slug}               Detalhe do item (portfolio/obras)
  /{locale}/…                           Mesma árvore noutra língua (en, fr) — prefixo exceto o padrão

  ── Rotas funcionais RESERVADAS (o tenant não pode sobrepor estes slugs) ──
  /marcar                               Fluxo de marcação           → /websites/booking
  /loja  ·  /loja/{produto}             Catálogo + ficha            → /websites/ecommerce
  /carrinho  ·  /checkout               Carrinho + checkout         → /websites/ecommerce
  /conta  ·  /entrar                    Conta do cliente + login    → /websites/customers
  /cancelar/{token}                     Cancelar marcação           → /websites/booking
  /inscrever                            Inscrição no ginásio        → /websites/gym
  /privacidade                          RGPD (obrigatório)          → CMS (cookies.*/privacy.*)

  ── Ficheiros SEO (gerados por tenant) ──
  /sitemap.xml   /robots.txt   /favicon (do tema)   hreflang + canonical por página
```

### B) Backoffice do tenant (nova área "Website")
```
/website                    O meu site (estado: rascunho/publicado, subdomínio, "Ver site")
  /website/template         Escolher template (galeria por vertical) — só antes de publicar / trocar
  /website/marca            Marca: preset de paleta + accent + par de fontes + logo
  /website/paginas          Gestor de páginas (add/remover/reordenar, slug, "na nav", collection?)
  /website/paginas/:id      Blocos da página (v1: add/remover/reordenar + variante + ligar conteúdo CMS)
  /website/dominio          Subdomínio (v1) · domínio próprio (fase posterior)
  /website/publicar         Publicar → revalida ISR
```
> A **edição fina inline** (WYSIWYG sobre o preview) é a **fase 2**; no v1, `/website/paginas/:id` é um gestor de blocos com formulários + preview em iframe.

---

## Navigation Model

**Site público (dinâmico, gerado do Site JSON):**
- **Primária:** itens das páginas com `inNav=true`, por `order` (máx. ~6) + **1 CTA principal** derivado da vertical (**Marcar** / **Comprar** / **Inscrever**).
- **Dentro da página:** sub-nav por **âncoras** opcional (páginas one-page longas coexistem com multi-página).
- **Utilitária:** seletor de língua (línguas ativas do tenant), **conta/entrar** (se houver clientes), ícone de **carrinho** (se houver loja).
- **Mobile:** header fixo (com a lição do scroll: `100dvh`/`overflow` corretos) + **drawer hamburguer**; o CTA principal pode fixar-se em baixo (barra de ação).

**Backoffice:** a área **"Website"** entra na sidebar (core, ver `Shell.tsx` `MENU_ORDER`); sub-navegação por `Tabs` (Template · Marca · Páginas · Domínio).

---

## Content Hierarchy

### Home (site público)
1. **Hero** — proposta de valor + CTA principal (marcar/comprar/inscrever). É o que converte.
2. **Prova/serviço** — Serviços/Planos/Produtos (o que o negócio vende).
3. **Confiança** — Testemunhos / Obras / Stats.
4. **Ação** — Booking/Loja/Inscrição inline (o "funcional").
5. **Contacto + Footer** — mapa, horários, RGPD.

### /website (backoffice — "O meu site")
1. **Estado + Ver site** — publicado? qual o URL? (a pergunta nº1 do tenant).
2. **Ações rápidas** — Editar páginas · Marca · Publicar.
3. **Setup pendente** — o que falta para publicar (logo? domínio? página vazia?).

### /website/paginas
1. **Lista de páginas** (arrastar p/ reordenar, toggle "na nav").
2. **Add página** (nome → slug automático → escolher blocos iniciais).
3. Página como **collection** (portfolio) — opção avançada.

---

## User Flows

### Fluxo 1 — Visitante marca/compra/inscreve (site público)
1. Chega a `{cliente}.plataforma.pt` (SSR, língua detetada/na URL).
2. Vê o Hero + CTA principal.
3. Clica **Marcar** (`/marcar`) — ou Comprar (`/loja`), ou Inscrever (`/inscrever`).
   - Booking: escolhe serviço/hora → confirma. *Sem conta* → só email; *com conta* → liga a `customerId`.
   - Loja: `/loja` → produto → `/carrinho` → `/checkout` (Stripe já existe).
   - Ginásio: `/inscrever` → lead/inscrição → CTA para a PWA.
4. Recebe confirmação (email/notif) + **"Adicionar ao calendário"** (.ics — Fase 1 do outro plano).

### Fluxo 2 — Tenant fica com site (onboarding, v1)
1. No backoffice, entra em **Website** (novo item, estado "rascunho").
2. **Escolhe template** por vertical (galeria com preview).
3. **Marca:** preset de paleta + accent + fontes + upload do logo.
4. **Páginas:** aceita as do template ou add/remove/reordena; edita conteúdo (via CMS/formulário) + escolhe variantes.
5. **Subdomínio:** propõe `{nome-do-negócio}` → valida disponibilidade → provisiona.
6. **Publicar** → revalida ISR → **site live**. Vê o URL + "Ver site".
   - Decisão: subdomínio ocupado → sugere alternativas.
   - Decisão: página obrigatória vazia (ex.: Contactos sem morada) → aviso não-bloqueante.

### Fluxo 3 — Add uma página (v1, gestor de páginas)
1. `/website/paginas` → **Add página**.
2. Nome → **slug** gerado (editável) → escolhe **blocos iniciais** (de uma paleta curada).
3. Toggle **"na nav"** + posição.
4. Guardar → aparece na nav dinâmica → **Publicar** para ir live.

---

## Naming Conventions

| Conceito | Label na UI (PT) | Notas |
|---|---|---|
| O site do tenant | **Website** / "O meu site" | Área no backoffice |
| Peça reutilizável | **Bloco** | Não "widget"/"componente" na UI |
| Layout alternativo de um bloco | **Variante** | — |
| Conjunto pré-montado | **Template** | Por vertical |
| Cor/fonte/logo do tenant | **Marca** | Não "tema" na UI (tema=interno) |
| Endereço | **Subdomínio** / **Domínio** | — |
| Tornar visível | **Publicar** | Rascunho → Publicado |
| Página que lista itens | **Coleção** | Portfolio/obras/projetos |

## Component Reuse Map

| Componente estrutural | Usado em | Diferenças |
|---|---|---|
| `SiteLayout` (renderer) | todas as páginas públicas | injeta tokens do tema + nav/footer do Site JSON |
| `Nav` (bloco) | todas as páginas | dinâmica (páginas `inNav`); variante por template |
| `Footer` (bloco) | todas as páginas | conteúdo do CMS |
| `BlockRenderer` | todas as páginas | mapeia `type`+`variant` → componente da biblioteca |
| `LocaleSwitcher` | header | línguas ativas do tenant |
| Backoffice `WebsiteShell` + `Tabs` | área Website | reutiliza `ui/ui.jsx` (`Tabs`, `Card`) |

## Content Growth Plan

- **Páginas:** crescem via gestor de páginas; nav limita a ~6 no topo → excedente vai para "Mais"/footer.
- **Coleções** (obras/projetos/blog): paginação + filtro; detalhe em `/{slug}/{item}`.
- **Loja:** catálogo já pagina/filtra (`/websites/ecommerce`).
- **Línguas:** cada página ganha alternates `hreflang`; adicionar língua = ativar nas settings + traduzir no CMS.
- **Sites (tenants):** o engine escala horizontalmente (ISR por tenant) — sem rebuild por site novo.

## URL Strategy

- **Tenant:** por **hostname** — `{subdomínio}.{plataforma}.pt` (v1) → custom domain (mesma resolução) depois. Config do domínio-raiz = **env de plataforma**; subdomínio do tenant = **BD** (`websiteDomain`).
- **Locale:** padrão sem prefixo (`/servicos`); outras línguas com prefixo (`/en/servicos`). `canonical` + `hreflang` por página.
- **Slug de página:** `/{slug}` (nível 1); coleção `/{slug}/{item-slug}` (nível 2). Slugs gerados do nome, editáveis, únicos por site.
- **Rotas reservadas:** `/marcar /loja /carrinho /checkout /conta /entrar /cancelar/:token /inscrever /privacidade /sitemap.xml /robots.txt` — nunca sobrepostas por slugs do tenant (validação ao criar página).
- **Query params:** loja (filtros/ordenação/página), booking (serviço/data pré-selecionados via deep-link).
