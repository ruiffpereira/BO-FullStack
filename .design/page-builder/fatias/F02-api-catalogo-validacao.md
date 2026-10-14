# F02 · API — Catálogo do núcleo, manifest e validadores puros

**Repo:** API-FullStack · **Tamanho:** L · **Depende:** F01 · **Agentes:** 1 Sonnet (construtor)
**Contrato:** §1, §3 (todo), §4, §6

## Objetivo
Toda a lógica de validação do construtor em módulos **puros** (sem BD, sem Express), muito testados. As fatias
F03–F06 só ligam isto às rotas. É aqui que se ganha ou perde a fiabilidade do épico.

## Ficheiros (novos, em `src/pageBuilder/`)
| Ficheiro | O que tem |
|---|---|
| `types.ts` | Tipos TS de I18n, Media, Dest, Component, Block, Page, Item, Part, Manifest, Issue |
| `catalog.ts` | O catálogo do §3.3 em forma de máquina (tipo → campos com tipo, i18n, max, min, options, seo, obrigatório) + `PARTS_DEFAULT` + `STARTERS` + forma serializável para o `GET` do editor |
| `manifest.ts` | Schema zod do §4 + `parseManifest()` + `manifestUsages(state)` (o que está em uso: estilos, fundos, ícones, especiais) |
| `fields.ts` | Validador por tipo de valor (§3.1): text, md, choice, media, dest, pages, list |
| `validate.ts` | `validateComponent`, `validateBlock`, `validatePart`, `validatePageItem`, `validatePage` → `Issue[]` com `path` e `locale` |
| `translations.ts` | `missingTranslations(value, field, langs, base)` e o varrimento do estado inteiro (§6.4) |
| `paths.ts` | regras de slug, reservados, `buildPath(page, pagesById)`, caminhos por língua (`slugs`), detecção de ciclos, profundidade |
| `refs.ts` | recolhe `dest`/`pages` de componentes e especiais; `pageRefs(pageId, state)`, `blockUsage(blockId, state)` |
| `limits.ts` | números do §6.8 |
| `resolve.ts` | **só as funções puras** de resolução para o público (§7): I18n → texto, media → URL, dest → href. (A montagem do objecto é no F06.) |

Testes: `tests/pageBuilder/*.test.ts` (um por ficheiro) + fixture `tests/fixtures/manifest-winterplateau.json`
(o exemplo do §4, completo para os tipos com estilos na Winterplateau).

## Brief para o agente (copiar)
> És um construtor na API-FullStack. Implementa em `src/pageBuilder/` os módulos da tabela da fatia F02
> (`Backoffice/.design/page-builder/fatias/F02-api-catalogo-validacao.md`) seguindo **à letra** o CONTRATO §3, §4 e §6.
> Tudo puro: recebe objectos, devolve resultados; nada de Sequelize, `req`/`res` ou `fetch`.
> A verificação de "ficheiro do tenant" recebe uma função `isOwnedUrl(url): boolean` injectada (a implementação real
> vem no F07). As línguas e a língua base são parâmetros (nunca `pt/en/fr` fixos).
> Usa zod para o manifest; não uses JSON Schema (a sanitização global apaga `$ref`). Os `Issue` têm `code` estável
> (`MISSING_TRANSLATION`, `REQUIRED`, `TOO_LONG`, `BAD_STYLE`, `BAD_COL`, `BAD_TYPE`, `BAD_DEST`, `FOREIGN_MEDIA`,
> `BAD_SLUG`, `RESERVED_SLUG`, `DUPLICATE_PATH`, `CYCLE`, `TOO_DEEP`, `LIMIT`, `UNKNOWN_SPECIAL`, …) e um `path`
> legível (`comps.<id>.v.items.<_id>.text`).
> Testes em `tests/pageBuilder/`: para **cada** tipo do catálogo, um caso válido e os inválidos relevantes; cada
> tipo de valor (§3.1) com os limites; manifest válido/ inválido/ com chaves estranhas; traduções (base preenchida e
> outra língua vazia → issue com `locale`; `media` `same:false`); slugs reservados e repetidos por língua; ciclos e
> profundidade; `dest.url` com `javascript:` e `data:` recusados; vídeo fora do YouTube recusado.
> `pnpm test` e `pnpm run build` verdes. Relatório ≤ 300 palavras.

## Revisão do supervisor
- [ ] O catálogo bate com o §3.3 campo a campo (abrir lado a lado)
- [ ] Nenhuma língua fixa no código; nenhuma função impura
- [ ] `dest.url`: allowlist de protocolos (não blocklist)
- [ ] Os `code` dos Issue estão listados num `enum`/union exportado (o Backoffice vai mapeá-los)
- [ ] Orçamento: `src/pageBuilder` ≤ ~1 500 linhas nesta fase

## Gates
`pnpm run docker:test && pnpm test && pnpm run build && pnpm run docker:test:down`

## Fecho
Commit `feat(site-builder): catálogo do núcleo, manifest e validação` — **sem push** (PLANO §5). `TASKS.md`: F02 ✅.

## Se a sessão estiver a ficar sem contexto
Cortar em dois commits verdes: (1) `types` + `catalog` + `fields` + `manifest` com testes; (2) `validate` +
`translations` + `paths` + `refs` + `resolve`. Escrever o "Retomar em" com o que falta.
