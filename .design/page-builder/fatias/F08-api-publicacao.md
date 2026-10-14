# F08 · API — Publicação (GitHub, job, estado, prova no ar)

**Repo:** API-FullStack (+ `spec.json`) · **Tamanho:** M · **Depende:** F05 e a decisão D-B do F00
**Agentes:** 1 Sonnet · `seguranca-api` · `pentest-api` (segredos)
**Contrato:** §8, §5.3, §5.4 (`/publish`, `/publish/test`), §2 (colunas publish*)

> Se no F00 o dono escolheu **webhook do Coolify** em vez do GitHub: trocar o "dispatch" por um `POST` ao URL do
> webhook com o token, **só** se a API alcançar o painel (provar antes com um pedido de teste). O resto da fatia igual.

## Objetivo
Para sites Astro: cada gravação leva, ~1 minuto depois, a um build; o Backoffice vê "A publicar…" → "No ar · hh:mm"
→ ou "Falhou", e "No ar" só aparece quando o site já serve a revisão gravada.

## Ficheiros
- Novos: `src/pageBuilder/publish.ts` (dispatch, estado do run, leitura do `cms-build.json`), `src/jobs/siteBuilderPublish.ts`
  (node-cron a cada minuto), `tests/backoffice/siteBuilderPublish.test.ts`.
- Mexe: `siteBuilderAdminController.ts` (`putPublish`, `testPublish`), `siteBuilderController.ts` (`publishNow`, e o
  `publish` no `GET`), rotas, `index.ts` (arrancar o job como os outros de `src/jobs`).

## Brief para o agente (copiar)
> Implementa o CONTRATO §8 e as rotas `PUT /admin/users/:userId/site-builder/publish`,
> `POST /admin/users/:userId/site-builder/publish/test` e `POST /cms/site-builder/publish` (rate limit 1/min/tenant).
> Token cifrado com `src/utils/crypto.ts` (ver `models/googleIntegration.ts:123-144` para o padrão de hooks),
> nunca devolvido; o campo do corpo chama-se `token`. Job a cada minuto: para cada tenant com
> `publishMode='github'` e `publishRequestedAt > publishDispatchedAt` e `now - publishRequestedAt ≥ 60 s`, faz
> `POST https://api.github.com/repos/{repo}/actions/workflows/{workflow}/dispatches` com `{ref}` (timeout 8 s), guarda
> `publishDispatchedAt` e `publishStatus='running'`; depois procura o run (`GET …/runs?event=workflow_dispatch&created>=`)
> e quando acabar lê `https://<User.websiteDomain>/cms-build.json?ts=<now>` (timeout 5 s, `redirect:'manual'`) →
> `liveRevision`; `live` se `liveRevision ≥` revisão gravada, senão `failed` com motivo. Usar lock na linha
> (precedente `pendingCheckoutAt` em `src/services/platformBilling.ts:587-612`) para não disparar duas vezes.
> `fetch` mockado nos testes. Testes: debounce (3 saves seguidos = 1 dispatch), token nunca no `GET`, falha do GitHub
> → `failed` com mensagem, `cms-build.json` com revisão antiga → não fica `live`. ≤ 300 palavras.

## Brief para `seguranca-api` / `pentest-api`
> Rotas de publicação. Cobre: token nunca em respostas, logs, audit nem registo de suporte; tenant não consegue mudar
> o repo/token (só o dono); `websiteDomain` interno/IP nunca é contactado (já validado por `isPublicHostname`, confirmar);
> o job não segue redirects; `publish` agora abusado (rate limit).

## Revisão do supervisor
- [ ] O job tolera reinício da API a meio (estado na BD)
- [ ] Nenhum `console.log` com o token; erros do GitHub truncados a 500 caracteres
- [ ] `deploy.yml` do winterplateau precisa de `concurrency` (fica anotado para o F19)

## Gates · Fecho
API gates + `pnpm kubb:refresh`. Commits — **sem push** (PLANO §5). `FUNCIONALIDADES.md`. `TASKS.md`: F08 ✅.
