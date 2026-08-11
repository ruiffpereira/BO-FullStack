# DESIGN BRIEF — Texto dos sites no CMS (site-cms-content)

**Data:** 2026-08-11 · **Decisão do dono:** todo o texto visível nos sites dos tenants (site-engine) tem de viver no CMS (contexto `website`), editável na página **Conteúdos → Site público** do Backoffice — como os sites antigos (winterplateau/tifas-barber). Hoje o texto vive inline no Site JSON (`block.settings.content[locale]`) e só é editável no modal de blocos da página Website — por isso o dono/tenant "não consegue alterar texto nenhum" em Conteúdos.

## Modelo mental (decidido)

- **Estrutura fixa, texto no CMS.** A estrutura (template, páginas, blocos, variantes) é decidida na criação da conta e gerida na página Website; **todo o texto** (títulos, corpos, labels, imagens de conteúdo, itens de listas) vive em `ContentEntry` (contexto `website`).
- O CMS é a **fonte de verdade** do texto. O conteúdo inline no Site JSON passa a **fallback legado** (nunca mais é escrito; continua a ser lido se não houver entrada CMS — sites antigos nunca partem).

## Esquema de chaves (determinístico)

| O quê | Chave CMS |
|---|---|
| Campo de bloco | `site.<blockId>.<campo>` (ex.: `site.b1.titulo`) |
| Campo aninhado/lista | `site.<blockId>.<campo>.<índice1based>.<subcampo>` (ex.: `site.b3.items.1.q`) — mesmo padrão dos sites antigos (`project.x.stat.1.value`). Listas de strings: `site.<blockId>.<campo>.1`, `.2`, … |
| Título de página (nav) | `site.page.<pageId ?? slug ?? "home">.title` |
| Rodapé | `site.footer.<campo>` (+ `site.footer.columns.<i>.title`, `site.footer.columns.<i>.links.<j>.label`; os `to` são type `data`) |

- `blockId` é estável (não muda com reordenação/página) — chaves sobrevivem a reestruturações.
- Prefixo `site.` cai no contexto `website` do `keyContext()` da API (não começa por `product./service./gym.`) — aparece na tab "Site público" de Conteúdos sem mudanças lá.
- Tipos: string→`text`; URLs de imagem→`image`; hrefs/slugs/valores não-texto→`data`. Índices 1-based no CMS (como os sites antigos); conversão para arrays 0-based é do unflatten.

## Secções (organização em Conteúdos)

Hierarquia criada pela migração/seed: secção raiz **"Site"** → uma subsecção por página (nome = título da página) → entradas dos blocos dessa página dentro; `site.footer.*` numa subsecção "Rodapé". Só organização — a resolução é sempre pela chave.

## Fluxo de dados

1. **API → renderer:** `GET /websites/site?host=` e `/preview` passam a incluir `cms: Record<locale, Record<key,value>>` com TODAS as entradas `site.%` do tenant (todas as locales; o renderer decide o fallback). Uma query (`key LIKE 'site.%'`), payload pequeno, cache ISR de 60s já existente. O renderer NÃO faz fetch extra nem precisa de site-token.
2. **Renderer:** `resolveBlockContent` passa a: `unflatten(cms[locale] ∪ cms[defaultLocale], prefixo "site.<blockId>.")` **deep-merged POR CIMA** do inline content (CMS ganha campo a campo; inline preenche o que faltar). Nav (`page.title`) e Footer resolvem igual com os prefixos respetivos. Sem CMS no payload → comportamento atual intacto.
3. **Seed (signup):** depois do `seedDraftSite`, um `seedSiteCms(userId, site)` flatten-a o texto do template para entradas CMS (skip-if-exists) + secções. O helper de flatten é **um só** (`src/utils/siteCms.ts` na API), partilhado por seed e migração.
4. **Migração (corre no deploy):** para cada `Site` existente, o mesmo flatten (skip-if-exists — nunca pisa entradas que o tenant já tenha). Inline content fica na BD como fallback, nunca é apagado.
5. **Backoffice:** o `BlockContentModal` mantém a MESMA UI (formulários ricos, tabs por língua, upload diferido), mas o save passa a fazer upsert das entradas CMS (flatten do draft) em vez de gravar `settings.content` — e o draft inicial lê do CMS (fallback ao inline). Remoção de itens de lista apaga as entradas de índice ≥ novo comprimento. `Conteudos.tsx` não muda: as entradas simplesmente aparecem lá.

## Fora de âmbito (deliberado)

- Textos de `settings` (anúncio/férias/SEO): a superfície Definições é removida (ver brief website-simplify) — sem editor, ficam os defaults do renderer.
- Traduzir automaticamente o que só existe em PT nos templates; multi-língua continua manual em Conteúdos.
- Apagar o inline content da BD (cleanup fica para depois de provado em produção).

## Batches de build

- **A (API):** `src/utils/siteCms.ts` (flatten/unflatten helpers + testes) · `cms` no payload público (host+preview) · `seedSiteCms` no signup · migração de backfill · FUNCIONALIDADES.md.
- **B (site-engine):** resolução CMS-over-inline em `lib/site.ts` (+ nav titles, footer) · testes.
- **C (Backoffice):** `BlockContentModal`/`PageBlocksSection` save→CMS · testes unit.

A precede B e C; B ∥ C (repos diferentes). Definition of Done: testes + CLAUDE.md atualizados.
