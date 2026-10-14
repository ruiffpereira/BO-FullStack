# F17 · winterplateau — Kit Astro: cliente, rotas por língua, SEO automático

**Repo:** winterplateau (Astro 4, npm) · **Tamanho:** L · **Depende:** F09 (contrato congelado) · **Agentes:** 1 Sonnet
**Contrato:** §7, §9 (parte "feito pelo site"), §8 (`cms-build.json`)
**Ler antes:** `winterplateau/CLAUDE.md`, `winterplateau/kubb.config.ts` (bypass `X-CI-Bypass`), `docs/ARMADILHAS.md` §sites externos

## Objetivo
O site passa a ser gerado a partir do objecto da API. Nesta fatia os componentes ainda são **simples e sem estilo
final** (o F18 dá-lhes o aspecto da Winterplateau): o que se prova aqui é o encanamento.

## O que tem de fazer
- `npm run kubb` com o spec novo (cliente tipado de `/websites/site`).
- `src/cms/client.ts`: no build pede `GET /websites/site?locale=xx` uma vez por língua (lista de `/websites/languages`),
  com `SITE_TOKEN` e `X-CI-Bypass`; **falha o build** em qualquer erro (nunca publicar um site vazio — o
  `src/lib/umami.ts` engole erros, não copiar esse padrão). Modo `CMS_FIXTURE=<ficheiro.json>` para build e testes
  sem API.
- Rotas: `src/pages/[...path].astro` para a língua base e `src/pages/[lang]/[...path].astro` para as outras, com
  `getStaticPaths` a partir de `pages[].path`; `build.format` passa a `directory` (URLs limpos). A home da base em `/`.
- `src/cms/Renderer.astro`: percorre `items` → `kind:'block'` desenha a grelha (layout, bg, `col`) e cada componente
  por `type` (`src/cms/components/<Type>.astro`); `kind:'special'` → `src/cms/specials/<type>.astro`. Tipo
  desconhecido → não desenha e avisa no build (nunca rebenta a página).
- `src/cms/text.ts`: `*itálico*`/`**negrito**` e markdown **sem HTML cru** (escapar tudo o resto).
- `src/layouts/Base.astro`: `lang` da página, `<title>`, description, canonical, `hreflang` dos `alternates`,
  Open Graph, JSON-LD (Organization + BreadcrumbList sempre; FAQPage/LocalBusiness/Review quando a página tem esses
  componentes), `noindex` quando pedido.
- Gerados no build: `sitemap.xml` (só publicadas sem `noindex`, com alternates), `robots.txt`, `cms-build.json`
  (`{revision}`), e os `redirects` (config `redirects` do Astro, a partir do objecto).
- Endereços antigos do site actual (`/Projetos.html`, `/Projeto.html?obra=…`, `/privacidade`) → redirects
  (o `?obra=` precisa de um pequeno script na página antiga, porque o static não lê query).
- Topo e rodapé desenhados em todas as páginas a partir de `topo`/`rodape`.

## Brief para o agente (copiar)
> Implementa a fatia F17 (`Backoffice/.design/page-builder/fatias/F17-site-kit.md`) no repo `winterplateau` seguindo o
> CONTRATO §7 e §9. Componentes do núcleo nesta fase = marcação semântica simples e acessível (um `.astro` por tipo,
> com `style` como classe `c-<type>--<style>`), sem o CSS final. Cria um `fixtures/site-pt.json` (e en, fr) válido
> segundo o contrato para correr `CMS_FIXTURE=… npm run build` sem API, e um teste em Node
> (`scripts/check-build.mjs`) que verifica no `dist/`: páginas por língua, `hreflang`, `sitemap.xml`, `robots.txt`,
> `cms-build.json`, redirects, e que nenhum texto de markdown sai como HTML cru. Não mexas nos componentes antigos de
> `src/components/` (o F18 decide o que fica). ≤ 300 palavras.

## Revisão do supervisor
- [ ] Build falha mesmo quando a API falha (testar com URL errado)
- [ ] Nenhum `set:html` com texto vindo da API sem passar por `text.ts`
- [ ] Orçamento do kit ≤ ~1 500 linhas nesta fase

## Gates · Fecho
`npm run kubb && CMS_FIXTURE=fixtures/site-pt.json npm run build && node scripts/check-build.mjs`. Commit num
branch `cms` (o site novo só substitui o antigo no F19, com dados reais) — **sem push** (PLANO §5). `TASKS.md`: F17 ✅.
