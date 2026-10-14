# Construtor de páginas — CONTRATO técnico (v1)

> Referência partilhada pelas fatias. **Não se lê inteiro**: cada fatia diz que secções (§) precisa.
> A API é a fonte da verdade; o Backoffice e os sites só espelham o que está aqui.
> Mudar este contrato depois do F09 = mudança cross-repo (Regra cross-repo do `CLAUDE.md` da raiz).

---

## §1 · Conceitos

| Termo | O que é |
|---|---|
| **Construtor** | A funcionalidade, ligada por tenant (`SiteBuilders.enabled`). Sem ela o menu "Páginas" mostra um estado vazio. |
| **Página** | Um endereço do site. Árvore (página-mãe → subpáginas). Tem nome, endereço por língua, estado, SEO e uma **lista ordenada de itens**. |
| **Item de página** | Uma entrada da lista da página: um **bloco** (da biblioteca) ou um **especial**. Tem "escondido nesta página". |
| **Bloco** | Vive na **biblioteca** do tenant. Tem nome, pasta, disposição (1–3 colunas), fundo, âncora e uma lista ordenada de **componentes**. Pode estar em várias páginas (partilhado). |
| **Pasta** | Só arruma a lista de blocos no Backoffice. Não chega ao site. |
| **Componente** | Peça do **núcleo universal** (§3): título, texto, botão… Tem `type`, `style` (dos que o site declara), `col` e valores. |
| **Especial** | Secção feita em código para **um** site (ex.: Edifício 3D da Winterplateau). Declarada no manifest (§4) com os seus campos. Entra na página como item, não dentro de blocos. |
| **Partes comuns** | `topo` e `rodape`: um de cada por site, iguais em todas as páginas, com componentes limitados (§3.3). |
| **Manifest** | JSON por site, carregado pelo dono no Admin: estilos de cada componente, fundos, ícones, especiais, componentes permitidos nas partes. |
| **Revisão** | Inteiro do tenant (`SiteBuilders.revision`), +1 a cada gravação. Serve para concorrência e para provar o que está no ar. |

**Línguas:** as do tenant (`User.languages`, ou só `User.defaultLanguage` se a lista estiver vazia). A **língua
base** é `User.defaultLanguage`. Nada de `pt/en/fr` fixo no código.

---

## §2 · Modelo de dados (Sequelize + MySQL)

Regras gerais: PK `UUID`; **`userId` em todas as tabelas** (isolamento barato, mesmo nas filhas); colunas
JSON **sem DEFAULT** (o MySQL recusa — ver `migrations/20261001120000-drop-sites.js:35`); prod 8.4, test 5.7.
Migração JS CommonJS `YYYYMMDDHHMMSS-kebab.js` com `up`/`down`. Todas as tabelas entram no
`hardDeleteTenantData` (sem cascata na plataforma).

```
SiteBuilders                 1 linha por tenant (existe = foi activado alguma vez)
  userId PK FK Users
  enabled            BOOL  default false
  manifest           JSON  null           — §4, validado na escrita
  revision           INT   default 0
  topo               JSON  null           — {comps:[Component]}                       §3.3
  rodape             JSON  null           — {layout, bg, comps:[Component]}           §3.3
  publishMode        ENUM('runtime','github') default 'runtime'
  githubRepo         STRING(140) null     — "dono/repo"
  githubWorkflow     STRING(140) null     — "deploy.yml"
  githubRef          STRING(100) null     — "main"
  githubTokenEnc     TEXT  null           — cifrado com src/utils/crypto.ts; NUNCA sai da API
  publishRequestedAt DATE  null
  publishDispatchedAt DATE null
  publishRunId       STRING(40) null
  publishStatus      ENUM('idle','pending','running','live','failed') default 'idle'
  publishError       STRING(500) null
  liveRevision       INT   null           — lida de https://<websiteDomain>/cms-build.json
  createdAt, updatedAt

SitePages
  id UUID PK · userId FK
  parentId     UUID null FK SitePages     — null = primeiro nível
  sortOrder    INT                        — ordem entre irmãs
  isHome       BOOL default false         — exactamente uma por tenant (a API garante)
  slug         STRING(80)                 — na língua base ("" na home)
  slugs        JSON null                  — {"en":"projects","fr":"projets"}; vazio = usa o da base
  path         STRING(255)                — calculado, língua base, único por tenant ("/obras/x")
  title        JSON                       — I18n (§3.1), obrigatório na base
  status       ENUM('draft','published') default 'draft'
  seo          JSON null                  — {title?:I18n, description?:I18n, keywords?:I18n,
                                             image?:Media, noindex?:bool, canonicalPageId?:UUID}
  createdAt, updatedAt
  UNIQUE(userId, path) · INDEX(userId, parentId, sortOrder)

SiteBlocks                   biblioteca
  id UUID PK · userId FK
  folderId   UUID null FK SiteBlockFolders
  sortOrder  INT
  name       STRING(120)                  — só para o Backoffice
  layout     TINYINT  (1|2|3)
  bg         STRING(40)                   — id de manifest.backgrounds
  anchor     STRING(60) null              — "#âncora"; único por tenant
  comps      JSON                         — [Component] (§3.2)
  createdAt, updatedAt
  UNIQUE(userId, anchor) · INDEX(userId, folderId, sortOrder)

SiteBlockFolders
  id UUID PK · userId FK · name STRING(80) · sortOrder INT · timestamps

SitePageItems
  id UUID PK · userId FK
  pageId      UUID FK SitePages
  sortOrder   INT
  kind        ENUM('block','special')
  blockId     UUID null FK SiteBlocks     — kind=block
  specialType STRING(60) null             — kind=special: chave de manifest.specials
  specialData JSON null                   — kind=special: valores dos campos do especial
  hidden      BOOL default false
  INDEX(pageId, sortOrder) · INDEX(userId, blockId)

SiteRedirects
  id UUID PK · userId FK
  fromPath   STRING(255)                  — endereço antigo, já com prefixo de língua se não for a base
  pageId     UUID FK SitePages
  createdAt
  UNIQUE(userId, fromPath)
```

**Porque não `ContentEntry`** (decisão D-A, confirmada pelo dono a 2026-10-14): os textos ficam em JSON `{lang: texto}` dentro
de cada campo. Com `ContentEntry`, o `GET /websites/content` devolveria o texto de rascunhos (devolve todas as
entradas do tenant e o site token é público), seria preciso blindar 5 escritores genéricos do CMS, o
`key` tem 100 caracteres, o índice único deixa duplicar `locale NULL`, e voltava o flatten/unflatten em
dois sítios que matou o site-engine. Para a cliente é igual: cada campo tem as suas traduções.

---

## §3 · Componentes

### §3.1 · Tipos de valor

| Tipo | Forma guardada | Regras |
|---|---|---|
| `I18n` | `{"pt":"…","en":"…"}` | Chaves ⊆ línguas do tenant. Ver §6.4 (traduções obrigatórias). |
| `text` | `I18n` ou string (se `i18n:false`) | `max` por campo; sem HTML (a sanitização global já tira tags); `*itálico*`/`**negrito**` permitidos |
| `md` | `I18n` ou string | Markdown sem HTML; `max` por campo |
| `choice` | string | Uma das `options` (fixas no catálogo, ou vindas do manifest, ex.: ícones) |
| `media` | `{"same":true,"values":{"pt":"https://…"}}` | `same:true` → só `values[base]`; `same:false` → uma por língua. URL **do storage do tenant** (§6.6). `kind`: image · file(pdf) · video |
| `dest` | `{"kind":"page","pageId":"…"}` · `{"kind":"anchor","blockId":"…"}` · `{"kind":"file","media":Media}` · `{"kind":"url","href":"…"}` | `page`/`anchor` têm de existir no tenant; `url` só `https:`, `http:`, `mailto:`, `tel:`, `/…`, `#…` |
| `pages` | `["pageId", …]` | Ids do tenant; `max` |
| `list` | `[{"_id":"k3f9…", …campos}]` | `min`/`max`; `_id` estável (nanoid 10) para ordenar sem perder traduções; **um nível só** (não há listas dentro de listas) |

Campos marcados `seo` aparecem no Backoffice dentro da caixa "Google (SEO)".

### §3.2 · Componente (forma)

```json
{ "id": "c_x81kq2",            // nanoid 10, estável
  "type": "titulo",            // §3.3
  "style": "seccao",           // id de manifest.styles[type]; tipos sem estilos no manifest → "normal"
  "col": "all",                // "all" | 1 | 2 | 3   (≤ layout do bloco; "all" = toda a largura)
  "v": { "text": {"pt":"Como *trabalhamos*","en":"How we *work*"}, "align":"right", "level":"h2" } }
```

### §3.3 · Catálogo do núcleo (universal — todos os sites implementam todos)

O catálogo vive **só na API** (`src/pageBuilder/catalog.ts`) e é entregue ao Backoffice no `GET` do editor:
o Backoffice desenha os formulários a partir dele (lição do site-engine: nunca copiar o catálogo à mão).

| type | Rótulo | Campos (`*` obrigatório na base) |
|---|---|---|
| `titulo` | Título | `text`* text·i18n·max160 · `align` choice(left,center,right)=left · `level` choice(h1,h2,h3,h4)=h2 **seo** |
| `etiqueta` | Etiqueta | `text`* text·i18n·max60 |
| `texto` | Texto | `body`* md·i18n·max5000 |
| `botao` | Botão | `label`* text·i18n·max60 · `dest`* dest |
| `lista` | Lista | `items` list(1..50){ `text`* text·i18n·max200 } |
| `numeros` | Números | `items` list(1..6){ `value`* text·max20 · `label` text·i18n·max60 · `sub` text·i18n·max80 } |
| `imagem` | Imagem | `image`* media(image) · `alt` text·i18n·max160 **seo** · `caption` text·i18n·max160 |
| `galeria` | Galeria | `items` list(1..40){ `image`* media(image) · `alt` text·i18n **seo** · `caption` text·i18n } |
| `video` | Vídeo | `source` choice(youtube,ficheiro) · `youtube` text·max200 (só youtube.com/youtu.be) · `file` media(video) · `poster` media(image) · `title` text·i18n **seo** |
| `mapa` | Mapa | `address`* text·max200 · `zoom` choice(cidade,rua)=rua · `title` text·i18n |
| `logotipos` | Logótipos | `items` list(1..40){ `image`* media(image) · `alt` text·i18n **seo** · `dest` dest? } |
| `iconetexto` | Ícone com texto | `items` list(1..12){ `icon` choice(manifest.icons) · `title`* text·i18n·max80 · `text` md·i18n·max500 } |
| `precos` | Tabela de preços | `items` list(1..6){ `name`* text·i18n · `price`* text·max20 · `period` text·i18n · `features` md·i18n · `highlight` choice(nao,sim)=nao · `cta` text·i18n · `dest` dest? } |
| `documentos` | Documentos | `items` list(1..50){ `name`* text·i18n·max120 · `file`* media(file) } |
| `paginas` | Cartões de páginas | `pick`* pages(1..12) |
| `citacoes` | Testemunhos | `items` list(1..20){ `quote`* md·i18n·max800 · `name`* text·max80 · `role` text·i18n·max120 } |
| `faq` | Perguntas frequentes | `items` list(1..30){ `q`* text·i18n·max200 · `a`* md·i18n·max2000 } → JSON-LD FAQPage |
| `negocio` | Empresa local | `name`* text · `address`* md · `phone` text · `email` text · `hours` list(0..7){ `day` text·i18n · `time` text } → JSON-LD LocalBusiness |
| `avaliacoes` | Avaliações | `items` list(1..30){ `stars` choice(5,4,3,2,1) · `name`* text · `text`* md·i18n·max800 } → JSON-LD Review |
| `contacto` | Contactos | `address` md · `phone` text · `email` text |
| `formulario` | Formulário de pedido | `types` list(0..12){ `name`* text·i18n } — o envio é sempre para `POST /websites/leads` |
| `menu` | Menu | `items` list(1..12){ `label`* text·i18n·max60 · `dest`* dest } |
| `redes` | Redes sociais | `items` list(1..8){ `network` choice(instagram,facebook,linkedin,youtube,tiktok,x) · `url`* text·https } |
| `linguas` | Selector de línguas | (sem campos) |
| `espaco` | Espaço | (sem campos; o tamanho é o `style`: p, m, g) |

**Partes comuns — componentes permitidos (por omissão, o manifest pode restringir):**
`topo`: imagem, menu, botao, linguas · `rodape`: texto, menu, contacto, redes, imagem, logotipos.

**Pontos de partida de bloco** (só atalhos no Backoffice, não ficam guardados como tal): Em branco · Título e texto ·
Texto e imagem (2 col) · Título e duas colunas · Faixa de chamada.

---

## §4 · Manifest do site

Validado por zod (`src/pageBuilder/manifest.ts`). **Não usar JSON Schema**: a sanitização global apaga chaves
`$ref`/`$schema` e qualquer `<…>` do corpo (`src/middleware/security.ts:149-191`). Corpo ≤ 1 MB.

```json
{
  "version": 1,
  "styles": {
    "titulo":  [{"id":"destaque","label":"Destaque"},{"id":"seccao","label":"Secção"},{"id":"frase","label":"Frase grande"}],
    "texto":   [{"id":"normal","label":"Normal"},{"id":"grande","label":"Introdução"},{"id":"pequeno","label":"Nota"}],
    "botao":   [{"id":"cheio","label":"Cheio"},{"id":"contorno","label":"Contorno"},{"id":"claro","label":"Contorno claro"}],
    "imagem":  [{"id":"normal","label":"Normal"},{"id":"redonda","label":"Cantos redondos"},{"id":"total","label":"Largura total"}],
    "espaco":  [{"id":"p","label":"Pequeno"},{"id":"m","label":"Médio"},{"id":"g","label":"Grande"}]
  },
  "backgrounds": [{"id":"claro","label":"Claro"},{"id":"escuro","label":"Escuro"},{"id":"marca","label":"Azul da marca"}],
  "icons": [{"id":"escudo","label":"Escudo"},{"id":"folha","label":"Folha"}],
  "parts": { "topo": ["imagem","menu","botao","linguas"], "rodape": ["texto","menu","contacto","redes","imagem"] },
  "specials": {
    "edificio3d": { "label":"Edifício 3D", "desc":"A ilustração animada do topo",
                    "fields": { "eyebrow": {"type":"text","i18n":true,"max":80} } },
    "faixa":      { "label":"Faixa a passar", "desc":"Nomes em contínuo",
                    "fields": { "items": {"type":"list","max":30,"of":{"name":{"type":"text","i18n":true,"max":40}}} } }
  }
}
```

Regras: tipos de `styles` ⊆ catálogo; ids `^[a-z][a-z0-9-]{0,29}$`; ≤ 8 estilos por tipo; ≤ 60 especiais;
campos de especiais usam os tipos de §3.1 (sem `dest` para `anchor`? — permitido, igual ao núcleo).
**Trocar o manifest não pode deixar órfãos:** se remover um estilo/fundo/ícone/especial em uso → `409
MANIFEST_IN_USE` com a lista de onde está a ser usado.

---

## §5 · API do editor (Backoffice)

Rotas sob `/api/cms/site-builder`, montadas com `authenticateToken, billingGate, authorizePermissions(["VIEW_SITE_PAGES"])`.

### §5.1 · `GET /cms/site-builder`
`200 {enabled:false}` se o tenant não tem o construtor activo. Senão:
```json
{ "enabled": true, "revision": 42, "languages": ["pt","en","fr"], "defaultLanguage": "pt",
  "catalog": {…§3.3 em forma de máquina…}, "manifest": {…§4…},
  "pages": [Page], "items": {"<pageId>": [Item]}, "blocks": [Block], "folders": [Folder],
  "parts": {"topo": {…}, "rodape": {…}}, "redirects": [{"fromPath":"/obra-braga","pageId":"…"}],
  "publish": {"mode":"github","status":"live","liveRevision":42,"requestedAt":null,"error":null},
  "limits": {…§6.8…} }
```

### §5.2 · `POST /cms/site-builder/save` — uma gravação = uma transacção
```json
{ "baseRevision": 42,
  "pages":   {"upsert": [Page], "delete": ["id"]},
  "blocks":  {"upsert": [Block], "delete": ["id"]},
  "folders": {"upsert": [Folder], "delete": ["id"]},
  "items":   {"<pageId>": [Item]},          // lista COMPLETA e ordenada de cada página tocada
  "parts":   {"topo": {...}, "rodape": {...}} }
```
- Ids de entidades novas são gerados no cliente (`crypto.randomUUID()`; nanoid para componentes/itens de lista).
- `200 {revision, redirectsAdded:[…]}` · `409 REVISION_CONFLICT {revision}` · `422 VALIDATION {issues:[Issue]}`.
- `Issue = {code, entity:"page"|"block"|"part"|"item"|"folder", id, path?:"comps.c_x81.v.items.k3f.text", locale?, message}`
  — o Backoffice usa-o para levar a cliente ao sítio do erro.

### §5.3 · `POST /cms/site-builder/publish` — "publicar agora" (salta a espera). Rate limit 1/min/tenant.

### §5.4 · Admin (dono da plataforma) — sob `/api/admin/users/:userId/site-builder`
Montadas no `adminUserRoutes` existente (já tem `authenticateToken → forbidDuringImpersonation → VIEW_ADMIN`).
- `GET` → `{enabled, manifestSummary, publish:{mode, repo, workflow, ref, hasToken, status}}` (nunca o token)
- `PUT` → `{enabled}` (cria a linha se não existir)
- `PUT /manifest` → corpo = manifest (§4); `409 MANIFEST_IN_USE`
- `PUT /publish` → `{mode, repo?, workflow?, ref?, token?}` (token só de escrita; omitir = manter)
- `POST /publish/test` → verifica que o token chega ao workflow (GitHub `GET /repos/{repo}/actions/workflows/{wf}`)

---

## §6 · Regras do servidor (todas verificadas no `save`, sobre o estado **final** do tenant)

1. **Isolamento:** tudo filtrado por `userId`. Um id do corpo que exista **noutro tenant** → `404` (nunca actualizar a linha de outro). Testar com tenants A/B.
2. **Concorrência:** `SELECT … FOR UPDATE` na linha `SiteBuilders` do tenant; `baseRevision ≠ revision` → `409`.
3. **Árvore:** sem ciclos; uma `isHome`, sempre no primeiro nível, sem filhas; profundidade ≤ 4.
4. **Traduções obrigatórias:** todo o `I18n` com valor na língua base tem de ter todas as línguas do tenant; todo o `media` com `same:false` e valor na base tem de ter todas. Campos `*` têm de ter valor na base. Falha → `422` com `code:"MISSING_TRANSLATION"` e `locale`.
5. **Endereços:** slug `^[a-z0-9]+(-[a-z0-9]+)*$` ≤ 80; reservados: códigos de língua do catálogo de línguas, `api`, `_astro`, `assets`, `sitemap.xml`, `robots.txt`, `cms-build.json`; `path` único por tenant e por língua (incluindo `slugs`). Path de uma página muda (slug ou mudança de mãe) → cria `SiteRedirects` do antigo para a página, para ela **e para as descendentes**; remove redirects cujo `fromPath` passou a ser um path vivo.
6. **Ficheiros:** URLs de `media` têm de pertencer ao storage do tenant (prefixo `<userId>/` — mesmo critério do `isOwnedKey` do `uploadController`). Vídeo do YouTube só `youtube.com`/`youtu.be`.
7. **Referências e protecções:** `dest.page`/`pages` → página do tenant; `dest.anchor` → bloco do tenant com âncora. Apagar página com filhas ou referenciada por qualquer bloco/parte → `409 PAGE_IN_USE {refs}`. Apagar bloco presente em alguma página → `409 BLOCK_IN_USE {pages}`. Apagar pasta com blocos → `409 FOLDER_NOT_EMPTY`. A home não se apaga.
8. **Limites:** 200 páginas · 500 blocos · 40 componentes por bloco · 60 itens por página · listas conforme §3.3 · corpo do `save` ≤ 1 MB (limite do express).
9. **Componentes válidos:** `type` no catálogo (ou permitido na parte); `style` existe no manifest; `col ≤ layout`; campos conforme §3.1; especiais conforme manifest.
10. **Nunca HTML.** O texto é guardado como veio (a sanitização global já tirou tags) e os sites renderizam markdown **sem HTML cru**.

---

## §7 · Objecto público (os sites lêem isto)

Rotas com `authenticateTokenPublic` (site token). **Sem `publicRateLimit`** (30/min/IP partia builds e SSR —
`src/middleware/security.ts:24-61`); fica só o global. `Cache-Control: no-cache` + ETag. Construtor desligado → `404`.

- `GET /websites/site?locale=en` → o site inteiro numa língua (para builds Astro: um pedido por língua).
- `GET /websites/site/page?path=/en/projects` → uma página (para sites em runtime). Path antigo → `200 {redirect:"/en/new"}`; inexistente/rascunho → `404`.

```json
{ "revision": 42, "locale": "en", "defaultLanguage": "pt", "languages": ["pt","en","fr"],
  "topo":   {"comps":[ResolvedComponent]},
  "rodape": {"layout":3,"bg":"escuro","comps":[ResolvedComponent]},
  "pages": [{
     "path": "/en/projects", "alternates": {"pt":"/obras","en":"/en/projects","fr":"/fr/projets"},
     "title": "Projects", "updatedAt": "2026-10-14T…",
     "seo": {"title":"Projects · Winterplateau","description":"…","image":"https://…","noindex":false,"canonical":null},
     "breadcrumb": [{"title":"Home","path":"/en"},{"title":"Projects","path":"/en/projects"}],
     "items": [
       {"kind":"special","type":"edificio3d","fields":{"eyebrow":"Vila Verde · Since 2016"}},
       {"kind":"block","anchor":"como","layout":2,"bg":"claro","comps":[
          {"type":"titulo","style":"seccao","col":"all","text":"How we *work*","align":"right","level":"h2"},
          {"type":"botao","style":"cheio","col":1,"label":"Request a quote","href":"/en#orcamento"} ]}
     ] }],
  "redirects": [{"from":"/obra-braga","to":"/obras/reabilitacao-fachada-braga"}] }
```
Resolução: `I18n` → texto da língua (cai na base se faltar); `media` → URL da língua; `dest` → `href` final
(página em rascunho/inexistente → `href:null`, o site mostra o texto sem ligação); `anchor` → caminho da primeira
página publicada onde o bloco está + `#âncora` (mesma página → só `#âncora`); `pages` → cartões
`{title, href, description, image}` só de páginas publicadas. **Nunca** sai: rascunhos, itens escondidos, ids
internos (fora âncoras), token, manifest, pastas, nomes de blocos.

---

## §8 · Publicação

- `runtime` (React/Next): não há nada a disparar; o site lê a API. Next tem de renderizar dinâmico ou `revalidate ≤ 60`.
- `github` (Astro): cada `save` marca `publishRequestedAt`. Um job (`src/jobs`, `node-cron` a cada minuto, estado
  persistido como o precedente `pendingCheckoutAt` + lock) dispara `workflow_dispatch` quando passou ≥ 60 s sem
  gravações. Token fine-grained **de um só repo**, só `Actions: write`. Depois do run: lê
  `https://<websiteDomain>/cms-build.json?ts=` (timeout 5 s, sem seguir redirects) → `live` quando `revision ≥` à gravada.
  "Deploy: success" não prova nada (ARMADILHAS) — só o `cms-build.json` prova.
- O `deploy.yml` do site leva `concurrency: {group: deploy, cancel-in-progress: false}` (1 a correr + 1 pendente).

---

## §9 · SEO

**Feito pelo site (kit):** `<title>`/description por página e língua · canonical · `hreflang` (dos `alternates`) ·
Open Graph · JSON-LD (Organization, BreadcrumbList, FAQPage, LocalBusiness, Review) · `sitemap.xml` (só publicadas
e sem `noindex`, com alternates) · `robots.txt` · redirects (no Astro: `redirects` no build) · `cms-build.json {revision}`.

**Verificação no Backoffice** (orientação, não bloqueia gravar): um só H1 · níveis por ordem · título no Google
30–60 (com " · <site>") · descrição 70–160 · título repetido noutra página · palavra-chave principal (a primeira
de `keywords`) no título, H1, descrição, endereço e primeiro parágrafo · ≥ 150 palavras · imagens sem `alt` ·
pelo menos uma ligação interna · ligações para rascunhos · `noindex` ligado. Pontuação = % de verificações certas.
O Google **não lê** a lista de palavras-chave — servem para guiar a escrita.

---

## §10 · Ficheiros de referência

- Protótipo navegável (UX, não código a reaproveitar): [`prototipo.html`](prototipo.html)
- Manifest de exemplo da Winterplateau: nasce no F02 (`tests/fixtures/manifest-winterplateau.json` na API) e é finalizado no F19.
