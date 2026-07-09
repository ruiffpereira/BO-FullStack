# Build Tasks: Editor de Site Tenant-Facing COMPLETO (gate de produção)

Data: 2026-07-04 · Objetivo: **um tenant configura o site de cima a baixo sozinho e publica** — até isto
estar feito, NÃO vai para produção (decisão do user). Baseado no gap-scout (plumbing sólido; 3 bloqueadores).
Execução: agentes Sonnet + review adversarial por fatia; commits locais → push. Un-gate é a ÚLTIMA fatia.

## Bloqueadores de produção

- [x] **A — Preview ao vivo do rascunho** [API+renderer+BO] — feito (BO `644272d`, 2026-07-04; renderer `27db7ac`/`6783d2d`, `/preview` + frame-ancestors):
  - [API] Endpoint que devolve o **Site do tenant independentemente de `published`**, autenticado. Abordagem:
    `POST /website/preview-token` (authenticateToken, req.user) → devolve URL/token de preview curto e assinado;
    `GET /websites/site/preview?token=` (público, verifica o token assinado → devolve o Site draft do userId).
  - [renderer] Rota `app/preview/[[...slug]]` (ou modo por cookie/header) que consome o endpoint de preview,
    **sem cache** (`dynamic="force-dynamic"`), rende o rascunho.
  - [BO] `<iframe>` do preview no editor (tab "O meu site" + idealmente nas outras tabs), **refresca ao Guardar**
    (após `useSaveSite`/save de bloco). Substitui a amostra estática `BrandPreview`.
  - Review de segurança (token assinado curto; só o próprio Site; sem fuga cross-tenant).
- [x] **B — Upload de imagens no editor** [BO] (API já feita — só ligar) — feito (`ebcec1f`, 2026-07-04):
  - Ligar `FileUpload` (`uploadImage`→`POST /api/uploads`, já usado em Conteúdos/Loja/Ginásio/Chat) em TODOS os
    campos de imagem `url(...)` do `blockFields.tsx` (`PrimitiveFieldInput` + gallery do `ItemsArrayEditor`) e no
    **logo** do `BrandTab` (hoje é só um Input de URL). Upload diferido onde fizer sentido.
- [x] **C — Un-gate `/website` para tenants** [BO, 1 linha] — remover `isAdmin ? [...] : []` no `Shell.tsx:183`
  + `/website` em `CORE_PATHS`. **FAZER POR ÚLTIMO** (só quando A+B+D estiverem prontos e revistos). — feito (`5e5d8d0`,
  2026-07-04). **Nota 2026-07-09:** revertido para gate temporário `VIEW_ADMIN` por decisão de produto (`ADMIN_GATED_PATHS`
  no `Shell.tsx`, commit `3cc0f24`) — rollout do editor ainda em curso; a API mantém-se tenant-open, gate é só de UI.
  Não é um "desfazer" do trabalho de C, é uma decisão de produto separada; reverter = devolver `/website` a `CORE_PATHS`.

## Para ficar "completo" (conteúdo que o tenant não consegue produzir de outra forma)

- [x] **D1 — Editor de Footer** [BO] — tab/secção que escreve `SiteFooter` (name/tagline/colunas de links/small print)
  via `PUT /website {footer}` (já editável na API). Feito: nova tab "Rodapé & Nav" (`FooterNavTab` em
  `Website.tsx`) com `name`/`tagline`/`smallPrint` + editor aninhado de colunas (`FooterColumnsEditor`/
  `FooterLinksEditor` — cada coluna com a sua própria lista de links, add/remover/reordenar em ambos os
  níveis); guarda com `useSaveSite({ footer })` preservando chaves não editadas. **Campo do link é `to`, não
  `href`** (a bater com `site-engine/components/blocks/Footer.tsx`). Testado em `tests/unit/Website.test.tsx`.
- [x] **D2 — Editor do Nav CTA** [BO] — form pequeno que escreve `SiteNav.cta` (label/to) via `PUT /website {nav}`.
  Feito: mesma tab "Rodapé & Nav" — toggle + `label`/`to`; guarda com `useSaveSite({ nav })` sempre a partir do
  spread do `nav` atual (preserva `nav.items` e outros campos), só substituindo `cta` (desligar → `cta: null`,
  o renderer cai no default da vertical via `resolveNavCta`). **`SiteNav.cta`/`NavItem` em `useWebsite.ts`
  corrigidos de `href` para `to`** (drift pré-existente nunca consumido — esta app não tinha editor de
  `nav.items`). Testado em `tests/unit/Website.test.tsx`.
- [x] **D3 — Schema do bloco `collection`** [BO] — entrada em `BLOCK_SCHEMAS` (`blockCatalog.ts`) com editor de itens
    (`slug/title/summary/image/tags/body`, a bater com `CollectionItem` do renderer), senão a page-kind "Coleção" é
    beco sem saída. Feito: `eyebrow/title/subtitle/emptyMsg` + `items[]` (slug obrigatório, title, summary, image via
    uploader, tags/body como `textareaLines`). Testado em `tests/unit/Website.test.tsx`.
- [x] **D4 — Dicas/labels dos blocos funcionais** [BO] (booking/products/gym/lead) — promover os poucos campos de
    string a form (ou pré-semear o editor KV com os nomes/labels PT), para serem descobríveis sem ler código.
    Feito: os 4 tipos ganharam `fields` (formulário rico, já não caem no editor genérico KV) com os campos exatos
    lidos por `Booking.tsx`/`Products.tsx`/`GymSignup.tsx`/`Lead.tsx` + um `dataHint` PT por tipo (explica que
    puxam/produzem dados reais de Agenda/Loja/Clientes, ou que o `gym` é só marketing). Testado em
    `tests/unit/Website.test.tsx`.

## Polish (não bloqueante)
- [ ] Empty-state nos blocos funcionais (explicar que puxam dados reais de Agenda/Loja/Ginásio).

## Ordem/rondas (para não emaranhar o working tree do BO)
1. **Ronda 1 (paralelo):** A-backend [API+renderer] · B [BO].
2. **Ronda 2:** A-frontend iframe [BO] · depois D1-D4 [BO] (sequencial no BO; tocam nos mesmos ficheiros).
3. **Ronda 3:** C un-gate [BO] + review e2e final → push.
