# F06 · API — Objecto público para os sites

**Repo:** API-FullStack (+ `spec.json` no Backoffice e no winterplateau) · **Tamanho:** M · **Depende:** F05
**Agentes:** 1 Sonnet · `seguranca-api` · `pentest-api` · **Skill:** `endpoint-api`
**Contrato:** §7, §6.10, §9 (parte "feito pelo site": o objecto tem de trazer o que o kit precisa)

## Objetivo
`GET /websites/site?locale=` e `GET /websites/site/page?path=` com a resolução completa do §7.

## Ficheiros
- Novos: `routes/websites/siteBuilder/siteRoutes.ts`, `controllers/websites/siteBuilder/siteController.ts`,
  `src/pageBuilder/assemble.ts` (monta o objecto a partir do estado + `resolve.ts` do F02),
  `tests/websites/siteBuilderPublic.test.ts`.
- Mexe: `routes/index.ts` (montar com `authenticateTokenPublic`, **sem** `publicRateLimit`), `FUNCIONALIDADES.md`.

## Brief para o agente construtor (copiar)
> Usa a skill `endpoint-api`. Implementa as duas rotas públicas do CONTRATO §7 com `authenticateTokenPublic`
> (o site token dá o `userId`). Sem `publicRateLimit` (o global chega). `Cache-Control: no-cache` e ETag do Express.
> Construtor desligado → 404. A montagem fica em `src/pageBuilder/assemble.ts` e é pura (recebe o estado, devolve o
> objecto), reaproveitando `resolve.ts`. Regras: só páginas `published`; itens `hidden` fora; `dest` para página em
> rascunho → `href:null`; âncoras resolvidas para a primeira página publicada que contém o bloco; `pages` → cartões só
> de publicadas; `alternates` por língua com os `slugs`; `breadcrumb`; `redirects` só para páginas publicadas;
> `page?path=` com path antigo → `200 {redirect}`. Nunca sair: rascunhos, ids internos (fora âncoras), manifest,
> pastas, nomes de blocos, token. Testes em `tests/websites/siteBuilderPublic.test.ts` cobrindo cada regra e as três
> línguas. Relatório ≤ 300 palavras.

## Brief para `seguranca-api`
> Rotas públicas novas. Cobre: site token do B nunca devolve conteúdo do A; texto de página em rascunho não aparece
> **em lado nenhum** da resposta (nem em cartões de `pages`, nem em `dest`, nem em `redirects`, nem no `breadcrumb`);
> itens escondidos fora; `path` com `..`, `%00`, 2 000 caracteres; `locale` inválido → base; resposta não inclui
> `githubTokenEnc`, `manifest`, `folderId`, `name` de blocos. Confirmar que `GET /websites/content` continua igual.

## Brief para `pentest-api` (antes do commit)
> Foco nas rotas públicas `/api/websites/site*` com os site tokens de A e B: tentar ler rascunhos, conteúdo escondido
> ou dados do outro tenant, enumerar páginas por `path`, forçar erros que vazem estado interno.

## Revisão do supervisor
- [ ] Montagem sem `publicRateLimit` e com o comentário do porquê (builds/SSR)
- [ ] Um build com 3 línguas = 3 pedidos (o site inteiro por língua)
- [ ] Tamanho da resposta da Winterplateau de exemplo < 300 KB por língua

## Gates · Fecho
API gates + `pnpm kubb:refresh` no Backoffice. No winterplateau o Kubb só entra no F17 (aí regenera-se). Commits — **sem push** (PLANO §5). `TASKS.md`: F06 ✅.
