# Build Tasks: Editor de Site Tenant-Facing COMPLETO (gate de produção)

Data: 2026-07-04 · Objetivo: **um tenant configura o site de cima a baixo sozinho e publica** — até isto
estar feito, NÃO vai para produção (decisão do user). Baseado no gap-scout (plumbing sólido; 3 bloqueadores).
Execução: agentes Sonnet + review adversarial por fatia; commits locais → push. Un-gate é a ÚLTIMA fatia.

## Bloqueadores de produção

- [ ] **A — Preview ao vivo do rascunho** [API+renderer+BO] (o maior; 0% feito):
  - [API] Endpoint que devolve o **Site do tenant independentemente de `published`**, autenticado. Abordagem:
    `POST /website/preview-token` (authenticateToken, req.user) → devolve URL/token de preview curto e assinado;
    `GET /websites/site/preview?token=` (público, verifica o token assinado → devolve o Site draft do userId).
  - [renderer] Rota `app/preview/[[...slug]]` (ou modo por cookie/header) que consome o endpoint de preview,
    **sem cache** (`dynamic="force-dynamic"`), rende o rascunho.
  - [BO] `<iframe>` do preview no editor (tab "O meu site" + idealmente nas outras tabs), **refresca ao Guardar**
    (após `useSaveSite`/save de bloco). Substitui a amostra estática `BrandPreview`.
  - Review de segurança (token assinado curto; só o próprio Site; sem fuga cross-tenant).
- [ ] **B — Upload de imagens no editor** [BO] (API já feita — só ligar):
  - Ligar `FileUpload` (`uploadImage`→`POST /api/uploads`, já usado em Conteúdos/Loja/Ginásio/Chat) em TODOS os
    campos de imagem `url(...)` do `blockFields.tsx` (`PrimitiveFieldInput` + gallery do `ItemsArrayEditor`) e no
    **logo** do `BrandTab` (hoje é só um Input de URL). Upload diferido onde fizer sentido.
- [ ] **C — Un-gate `/website` para tenants** [BO, 1 linha] — remover `isAdmin ? [...] : []` no `Shell.tsx:183`
  + `/website` em `CORE_PATHS`. **FAZER POR ÚLTIMO** (só quando A+B+D estiverem prontos e revistos).

## Para ficar "completo" (conteúdo que o tenant não consegue produzir de outra forma)

- [ ] **D1 — Editor de Footer** [BO] — tab/secção que escreve `SiteFooter` (name/tagline/colunas de links/small print)
  via `PUT /website {footer}` (já editável na API).
- [ ] **D2 — Editor do Nav CTA** [BO] — form pequeno que escreve `SiteNav.cta` (label/href) via `PUT /website {nav}`.
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
