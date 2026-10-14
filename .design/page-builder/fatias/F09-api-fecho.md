# F09 · API — Fecho: revisão cruzada, docs e contrato congelado

**Repos:** API-FullStack · Backoffice (`spec.json`) · **Tamanho:** S · **Depende:** F06, F07, F08 · **Agentes:** nenhum

## Objetivo
Antes de o Backoffice e o site começarem a consumir, a API do construtor fica revista como um todo e o contrato
congelado (mudanças depois disto são cross-repo).

## Passos (supervisor)
1. `git log --oneline` das fatias F01–F08; `git diff <antes-do-F01>..HEAD --stat` — confirmar o orçamento (§8 do PLANO).
2. Ler, lado a lado com o CONTRATO: `src/pageBuilder/catalog.ts`, `validate.ts`, `assemble.ts` e o controller do save.
   Anotar qualquer divergência → corrigir (agente Sonnet) **ou** actualizar o CONTRATO se a implementação estiver
   melhor (registar o porquê no fim do CONTRATO, secção "Alterações").
3. Correr a suite inteira uma vez.
4. Docs: `FUNCIONALIDADES.md` (secção "Construtor de páginas" completa), `REFERENCIA-MODULOS.md`, `CLAUDE.md` da API
   (invariantes: isolamento, nunca HTML, rascunhos nunca públicos, sem `publicRateLimit` nas rotas do site, validação
   só em `src/pageBuilder/`).
5. `pnpm kubb:refresh` no Backoffice; `spec.json` committado.
6. Marcar o CONTRATO como **v1 congelada** (data) no topo.

## Feito quando
- [ ] Sem divergências abertas entre código e CONTRATO
- [ ] Docs actualizados; CI verde nos dois repos
- [ ] `TASKS.md`: F09 ✅
