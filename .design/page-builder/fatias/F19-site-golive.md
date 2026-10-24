# F19 · Go-live da Winterplateau — manifest, importação, paridade, publicação e fecho do épico

**Repos:** API · Backoffice · winterplateau · raiz · **Tamanho:** M · **Depende:** F16, F18
**Agentes:** 1 Sonnet (script de importação) · dono (dados de produção, DNS, permissões)
**Contrato:** §4, §5.4, §8

## Passos
1. **Manifest final** da Winterplateau (estilos do D-D, fundos, ícones, especiais, partes) em
   `winterplateau/cms/manifest.json` (versionado no repo do site) e cópia em `API-FullStack/tests/fixtures/`.
2. **Script de importação** `API-FullStack/scripts/importSitePages.ts --user <id> --file <json> [--dry-run]`:
   cria páginas, blocos, partes e itens usando **o mesmo `save`** (mesmas validações) — nunca escrever nas tabelas
   por fora. JSON gerado a partir do site actual: texto PT dos componentes antigos + EN/FR do dicionário `i18n.js`
   (agente Sonnet monta o JSON; o supervisor revê amostras). As traduções que não existirem ficam por fazer — o
   Backoffice mostra-as a amarelo.
3. **Dono:** dá `VIEW_SITE_PAGES` à role (é o que liga o construtor — 2026-10-16), carrega o manifest (Admin), corre o script
   em produção com `--dry-run` e depois a sério, completa traduções em falta no Backoffice.
4. **Publicação:** `deploy.yml` do winterplateau com `workflow_dispatch` (já tem) e `concurrency` (§8); dono configura
   o modo GitHub no Admin (repo, workflow, token fine-grained só deste repo com Actions: write); "Testar".
4b. **Push final (a primeira vez que alguma coisa do épico sai do PC — PLANO §5):** correr a suite inteira dos três
   repos; depois push **API** → ver CI e o deploy (as migrações correm no arranque) → push **Backoffice** → ver CI →
   no winterplateau juntar o branch `cms` na `main` e push → ver o deploy. O dono confirma cada push.
5. **Paridade visual:** com o site novo no ar, comparar com o antigo em 1440/834/390,
   PT/EN/FR, página a página. Lista de diferenças → corrigir (F18) ou aceitar com o dono.
6. **Prova ponta-a-ponta:** mudar um texto no Backoffice → Guardar → "A publicar…" → "No ar · hh:mm" →
   o site mostra o texto novo e `cms-build.json` tem a revisão.
7. **Antes de apontar o domínio** (dono, DNS): os PDFs dos Downloads estão hoje no WordPress antigo
   (`http://www.winterplateau.pt/inc/uploads/…`) — carregá-los no Backoffice (F07) antes, senão partem.
8. **Fecho do épico:** `DECISOES.md` (o que se aprendeu, se algo mudou), `TASKS.md` da raiz (fechar o item e mover
   para `docs/5 - Historico/5.1 - tarefas feitas.md`), `CLAUDE.md` da raiz (tabela de projectos: winterplateau lê o construtor),
   `winterplateau/CLAUDE.md` (o fluxo novo), `FUNCIONALIDADES.md`, e o futuro no TASKS: pré-visualização,
   histórico de versões no servidor, kit React/Next para outros sites.

## Feito quando
- [ ] Site novo no ar com o conteúdo da Winterplateau vindo do construtor, nas três línguas
- [ ] Uma alteração no Backoffice chega ao site sozinha e o estado mostra "No ar"
- [ ] Docs e filas fechadas
