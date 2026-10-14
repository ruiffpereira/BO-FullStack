# F00 · Arranque — decisões, pendentes, CI do winterplateau

**Repos:** raiz · Backoffice · winterplateau · **Tamanho:** S · **Agentes:** nenhum (supervisor + dono)
**Contrato:** §1, §2 (só o parágrafo "Porque não ContentEntry")

## Objetivo
Fechar as decisões em aberto, arrumar o que ficou por commitar da sessão de desenho e pôr o deploy do
winterplateau a funcionar — sem isto, o F17–F19 não têm onde correr.

## Passos
1. ~~Perguntar D-A, D-B e D-C ao dono~~ — **já respondidas a 2026-10-14** (JSON · GitHub · "Páginas"), registadas no
   `DECISOES.md` e na §1 do `PLANO.md`. Não voltar a perguntar.
2. Confirmar que o `DECISOES.md`, o `TASKS.md` da raiz, o `PLAYBOOK.md` e esta pasta `.design/page-builder/` estão
   committados (ver passo 6); se não estiverem, perguntar ao dono antes de os commitar (a raiz pode ter alterações dele).
3. **Pendente da sessão de desenho — Backoffice "Site público" → "Website"** (por commitar):
   `src/lib/navigation.ts`, `src/pages/Conteudos.tsx`, `tests/e2e/pages/ConteudosPage.ts`,
   `tests/e2e/conteudos.spec.ts`, `REFERENCIA-PAGINAS.md`, `CLAUDE.md`. `tsc` e unitários já passaram.
   Falta: `pnpm exec playwright test tests/e2e/conteudos.spec.ts tests/e2e/rbac-matriz.spec.ts` → commit
   `feat(conteudos): "Site público" passa a chamar-se "Website"` — **sem push** (PLANO §5).
   (O "Ginásio (nomes)" → "Ginásio" **não** se faz: colide com o item do módulo — ARMADILHAS. Fica no TASKS.)
4. **Dono — deploy do winterplateau por CI** (seguir `CI-SETUP.md` da raiz): secrets `WIREGUARD_CONFIG`,
   `COOLIFY_DEPLOY_HOOK`, `COOLIFY_TOKEN`, variável `DEPLOY_ENABLED=true`; no Coolify, `SITE_TOKEN` e
   `VITE_API_BASE_URL` disponíveis **na fase de build**; o header `X-CI-Bypass` aceite pela regra WAF da Cloudflare.
   Prova (sem push): GitHub → Actions → deploy → "Run workflow" corre até ao fim e o site actualiza.
5. Confirmar `git status` limpo nos três repos antes do F01.
6. Commits da documentação (se ainda não feitos): raiz `docs: plano do construtor de páginas, decisões e regra do
   responsivo` (sem remote, sem push); Backoffice `docs(paginas): plano, contrato e fatias do construtor` (já feitos a 2026-10-14).

## Feito quando
- [x] D-A, D-B, D-C respondidas e no `DECISOES.md` (2026-10-14)
- [ ] Commit "Website" no Backoffice (o CI corre no push final, F19)
- [ ] Deploy do winterplateau por CI provado (ou registado em "A · Bloqueado no dono" do TASKS da raiz, sem parar o resto)
- [ ] `TASKS.md` desta pasta: F00 ✅
