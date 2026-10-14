# Construtor de páginas — plano de execução

> **Para:** a sessão que executa (Claude a supervisionar + agentes Sonnet a construir).
> **Origem:** sessão de desenho de 2026-10-13/14 com o dono. Protótipo aprovado: [`prototipo.html`](prototipo.html).
> **Épico:** a cliente (começando pela Winterplateau) monta o site inteiro no Backoffice — páginas, blocos feitos de
> componentes, partes comuns, especiais — e o site lê um objecto da API e desenha-o. A plataforma **não** desenha sites.

---

## 0 · Como usar este plano (ler sempre, é curto)

1. **Uma fatia por sessão.** Em cada sessão lê-se: **este ficheiro** + **o ficheiro da fatia** (`fatias/Fxx-*.md`) +
   **só as secções do [`CONTRATO.md`](CONTRATO.md) que a fatia indica**. Nada mais, salvo o código que a fatia manda abrir.
2. **Estado:** [`TASKS.md`](TASKS.md) desta pasta. Ao começar marca 🔄; ao acabar ✅ + hashes dos commits.
   Se parar a meio: escreve lá **"Retomar em: …"** com o passo exacto e o que já está feito.
3. **Ordem obrigatória:** as fatias dependem umas das outras (coluna *Depende* na §10). Não saltar.
4. **Ponto de paragem:** se o contexto da sessão passar de ~60 %, acabar o passo em curso, correr os gates, fazer
   commit do que está verde, escrever o "Retomar em" e parar. Nunca deixar código vermelho por commitar.
5. **Commit sim, push não.** Cada fatia acaba em commit(s) locais. **O push só acontece no F19**, de uma vez, por
   decisão do dono (§5). Nenhuma fatia faz push, nem para branches.
6. **Limite de utilização:** se a sessão parar por limite do plano, o trabalho fica no último commit verde e no
   "Retomar em". Ao voltar (ou na próxima acordadela do `/loop`), reler o `TASKS.md` e continuar daí.

---

## 1 · Decisões

**Fechadas com o dono (registadas no [`DECISOES.md`](../../../DECISOES.md) da raiz, 2026-10-14):**
- A cliente constrói: árvore de páginas, biblioteca de blocos (partilháveis, com pastas), componentes do núcleo com
  os estilos do site, partes comuns (topo e rodapé), especiais por site. Reabre 2026-09-29 e 2026-07-14.
- O separador **Website** de Conteúdos fica como está (outros clientes). O construtor é um menu novo, só para
  tenants com ele activo.
- Traduções obrigatórias campo a campo (texto, imagem, ficheiro); **não se grava** com traduções em falta; bolinha
  amarela em todos os níveis e "Ver onde" leva ao campo.
- SEO completo (§9 do contrato). Desfazer/refazer na sessão. Arrastar só pela pega (sem setas), igual em todo o lado.
- Duas colunas: lista (páginas · blocos · partes comuns) | centro (página com separadores *Conteúdo* e
  *Definições e SEO*; editor do bloco com caminho e anterior/seguinte).
- **Tudo no Backoffice funciona em computador, tablet e telemóvel** (regra permanente, também no PLAYBOOK).

**Confirmadas pelo dono a 2026-10-14 (também no `DECISOES.md`):**
- **D-A · Textos em JSON** `{língua: texto}` dentro das tabelas do construtor — **não** em `ContentEntry` (CONTRATO §2).
- **D-B · Publicação do Astro pelo `workflow_dispatch` do GitHub** — não pelo webhook do Coolify.
- **D-C · O menu chama-se "Páginas".**

**Ainda por decidir (no sítio certo, não antes):**
- **D-D · Estilos da Winterplateau:** hoje há 10 estilos de título e 3 de botão; juntar em ~3+3 — decide-se no F18
  com o dono, a olhar para capturas do site.

---

## 2 · Arquitectura numa página

```
Backoffice /paginas                 API-FullStack                          Site (winterplateau, Astro)
─────────────────────               ─────────────                          ───────────────────────────
estado de trabalho                  GET  /cms/site-builder   (editor)
(desfazer/refazer)  ── Guardar ──▶  POST /cms/site-builder/save            npm run build
                                      · 1 transacção, revisão              └─ GET /websites/site?locale=xx
catálogo + manifest ◀── GET ──        · valida tudo (§6)                       (1 por língua, site token,
desenham os formulários             SitePages · SitePageItems                  X-CI-Bypass, falha alto)
                                    SiteBlocks · SiteBlockFolders          └─ desenha items com o kit
Admin: activar · manifest ──▶       SiteRedirects · SiteBuilders           └─ sitemap · robots · redirects
       · publicação                 job 1/min ── workflow_dispatch ──▶ GitHub Actions → Coolify
                                    lê /cms-build.json ◀───────────────────── {revision}
```

---

## 3 · Papéis e ciclo de cada fatia

**Supervisor (Claude, modelo da sessão):** âmbito, decisões, briefs, revisão do diff, gates e `git commit` (o push é só no F19 — §5).
**Construtores (agentes, `model: "sonnet"`):** escrevem o código e os testes da fatia a partir do brief que está
no ficheiro da fatia. **Especialistas** (em `.claude/agents/`): `seguranca-api`, `pentest-api`, `e2e-backoffice`.

```
1. ler PLANO + fatia + §§ do contrato        5. supervisor corre os gates UMA vez (§5)
2. confirmar pré-requisitos (git status)     6. agente especialista da fatia (seguranca/pentest/e2e)
3. agente Sonnet constrói (brief da fatia)   7. findings → agente Sonnet corrige → gates outra vez
4. supervisor revê o diff contra o contrato  8. commit + TASKS.md + docs (push só no F19)
   e a checklist de revisão da fatia
```

> A skill `build-review-fix` citada no PLAYBOOK **não existe** em `.claude/skills/` — o ciclo acima é ela, à mão.
> As skills `design-review`/`frontend-design` também não estão instaladas: a revisão visual faz-se com capturas
> (Playwright) nas três larguras (§7) e olhando para elas.

---

## 4 · Disciplina de tokens (para a sessão não esgotar a meio)

- **Briefs fechados.** Cada fatia traz o brief pronto: o agente não redescobre o desenho, recebe-o.
- **Uma corrida antes, uma depois.** Não pedir "confirma 3×". Não correr a suite e2e inteira se o CI a corre a seguir
  — correr só os specs da fatia.
- **O supervisor lê o diff, não o repo.** `git diff --stat` primeiro, depois só os ficheiros que a checklist manda ver.
- **Um agente de cada vez por repo** (dois a escrever no mesmo repo dão falhas de testes fantasma — ARMADILHAS).
- **Saídas curtas:** pedir aos agentes um relatório final de ≤ 300 palavras com ficheiros tocados e resultado dos testes.
- Fatias marcadas **L** podem ocupar a sessão inteira: não juntar duas no mesmo dia/sessão.

---

## 5 · Gates (comando a comando)

```bash
# API-FullStack
pnpm run docker:test && pnpm test && pnpm run build && pnpm run docker:test:down
# Backoffice
pnpm lint && pnpm test:unit && pnpm exec playwright test <specs da fatia>
pnpm kubb:refresh            # sempre que o contrato da API mudou; commitar spec.json
# winterplateau
npm run kubb && npm run build                 # com SITE_TOKEN/VITE_API_BASE_URL, ou CMS_FIXTURE (F17)
```
**Push: só no fim do épico (F19), decisão do dono de 2026-10-14.** Até lá tudo fica em commits locais, por isso:
- os gates locais de cada fatia são o único filtro — correm-se completos (o CI só verá tudo no fim);
- antes do push final corre-se **a suite inteira** dos três repos uma vez;
- ordem do push final: API → Backoffice → winterplateau (branch `cms` junto na `main`), e ver o CI de cada um;
- o push pede sempre confirmação do dono (guarda do projecto) — nunca contornar.
**Migrações:** correm sozinhas no arranque da API em produção (`package.json`) → provar `up` **e** `down` numa BD
descartável (docker de teste) antes do commit. Correr migrações em produção é do dono.

---

## 6 · Segurança — regras transversais (o supervisor confirma em todas as fatias de API)

- `userId` em todas as consultas e em todas as tabelas; ids vindos do cliente que existam noutro tenant → `404`.
- `authorizePermissions(["VIEW_SITE_PAGES"])` **na rota** (nunca só na UI — o `VIEW_SITE_BUILDER` antigo era só UI).
  Admin: `forbidDuringImpersonation` antes de `VIEW_ADMIN` (montagem existente de `/admin/users`).
- zod em tudo o que entra; limites do CONTRATO §6.8; nada de HTML; markdown sem HTML cru no site.
- Público: nunca rascunhos, itens escondidos, token, manifest, pastas; sem `publicRateLimit`.
- Token do GitHub: cifrado (`src/utils/crypto.ts`), só de escrita, campo chamado `token` (o audit redige por nome),
  nunca em respostas nem no registo do acesso de suporte (o tenant vê os corpos lá).
- Saídas HTTP só para `api.github.com` e para o `websiteDomain` do tenant (já validado por `isPublicHostname`),
  com timeout e sem seguir redirects (SSRF).
- **Purga:** cada tabela nova no `hardDeleteTenantData` e na lista de `tests/backoffice/tenantHardDelete.test.ts`,
  senão o tenant fica inapagável.
- `pentest-api` antes do commit nas fatias que fecham isolamento: **F05, F06, F08**.

---

## 7 · Responsivo — computador, tablet, telemóvel (regra permanente)

- Larguras de prova: **1440** (computador), **834** (tablet), **390** (telemóvel).
- ≥ 1180 px: duas colunas. 860–1180: duas colunas mais estreitas. < 860: um ecrã de cada vez
  (lista → página → bloco) com "‹ voltar" — como no protótipo.
- Arrastar com **dnd-kit** com `PointerSensor` + `TouchSensor` (toque longo) + `KeyboardSensor` (Espaço + setas) —
  uma única implementação para todas as listas.
- Alvos de toque ≥ 40 px; nada de `hover` como única forma de ver uma acção (em `hover:none` os botões ficam visíveis).
- Alturas por flex (o `Shell` é dono da altura) — nunca `calc(100vh…)`/`h-screen`.
- Os specs e2e do construtor correm nas três larguras (projectos do Playwright).

---

## 8 · Orçamento de complexidade (o site-engine morreu a 21k linhas para um site de 4,2k)

| Área | Orçamento (sem testes) |
|---|---|
| API (`src/pageBuilder` + controllers + rotas + job) | ~3 000 linhas |
| Backoffice (`src/pages/paginas/**`) | ~5 000 linhas |
| Kit do site (winterplateau `src/cms/**` + componentes) | ~3 000 linhas |

Se uma área passar o **dobro**, parar e falar com o dono antes de continuar.

---

## 9 · Armadilhas já pagas que se aplicam aqui

- Sanitização global apaga tags e chaves `$ref`/`$schema`; com `<` no texto, `&` vira `&amp;` (`security.ts:149-191`).
- `publicRateLimit` = 30/min/IP partilhado → builds e SSR levam 429. Builds atrás da Cloudflare precisam de `X-CI-Bypass`.
- Cloudflare cacheia por extensão (`.js`, `.png`…): mudar URL (`?v=`) em vez de confiar em purge.
- "Deploy: success" ≠ deployado. Prova = `cms-build.json` com a revisão.
- Labels de subitens nunca duplicam nomes de itens da sidebar (getByRole). "Páginas" não colide hoje (só há um `h2`
  "Páginas mais vistas" em Estatísticas — role diferente).
- Componentes RBAC novos não chegam às roles existentes sozinhos: o dono dá `VIEW_SITE_PAGES` à role do tenant
  (Admin → Permissões) ou por migração de dados.
- Jobs em memória morrem a cada deploy da API → estado da publicação persistido na BD.

---

## 10 · Fatias

| # | Fatia | Repo | Tam. | Depende | Agentes |
|---|---|---|---|---|---|
| [F00](fatias/F00-arranque.md) | Arranque: decisões D-A..D-C, pendentes desta sessão, CI do winterplateau | raiz · todos | S | — | — |
| [F01](fatias/F01-api-modelos.md) | Modelos, migração, purga, permissão | API | M | F00 | Sonnet |
| [F02](fatias/F02-api-catalogo-validacao.md) | Catálogo, manifest e validadores puros | API | L | F01 | Sonnet |
| [F03](fatias/F03-api-editor-admin.md) | Leitura do editor + admin (activar, manifest) | API | M | F02 | Sonnet · seguranca-api |
| [F04](fatias/F04-api-gravar-paginas.md) | Gravar 1/2: páginas, árvore, endereços, redirects, itens | API | L | F03 | Sonnet · seguranca-api |
| [F05](fatias/F05-api-gravar-blocos.md) | Gravar 2/2: blocos, pastas, partes, especiais, traduções | API | L | F04 | Sonnet · seguranca-api · pentest-api |
| [F06](fatias/F06-api-publico.md) | Objecto público para os sites | API | M | F05 | Sonnet · seguranca-api · pentest-api |
| [F07](fatias/F07-api-uploads-pdf.md) | Uploads de PDF e dono dos ficheiros | API | S | F02 | Sonnet · seguranca-api |
| [F08](fatias/F08-api-publicacao.md) | Publicação (GitHub, job, estado, prova no ar) | API | M | F05 | Sonnet · seguranca-api · pentest-api |
| [F09](fatias/F09-api-fecho.md) | Fecho da API: revisão cruzada, docs, contrato congelado | API · BO | S | F06–F08 | — |
| [F10](fatias/F10-bo-base.md) | BO base: rota, menu, dados, estado, gravar | BO | M | F09 | Sonnet · e2e-backoffice |
| [F11](fatias/F11-bo-lista-lateral.md) | Lista lateral: árvore, pastas, partes, arrastar | BO | M | F10 | Sonnet |
| [F12](fatias/F12-bo-conteudo-pagina.md) | Centro: conteúdo da página, paleta de blocos | BO | M | F11 | Sonnet |
| [F13](fatias/F13-bo-campos.md) | Renderizador de campos (catálogo → formulário) | BO | M | F10 | Sonnet |
| [F14](fatias/F14-bo-editor-bloco.md) | Editor de bloco, componentes, partes, especiais | BO | L | F12 F13 | Sonnet |
| [F15](fatias/F15-bo-seo-traducoes.md) | Definições e SEO, SEO do site, "Ver onde" | BO | M | F14 | Sonnet |
| [F16](fatias/F16-bo-admin-e2e.md) | Admin no BO + e2e completo nas 3 larguras | BO | M | F15 | Sonnet · e2e-backoffice |
| [F17](fatias/F17-site-kit.md) | Kit Astro: cliente, rotas por língua, SEO automático | winterplateau | L | F09 | Sonnet |
| [F18](fatias/F18-site-componentes.md) | Componentes e estilos Winterplateau + especiais | winterplateau | L | F17 | Sonnet |
| [F19](fatias/F19-site-golive.md) | Manifest, importação, paridade, publicação, fecho | todos | M | F16 F18 | Sonnet |

F07 pode correr em qualquer altura depois do F02. F13 pode correr em paralelo com F11/F12 **noutra sessão** (outro
repo não; é o mesmo repo — fazer em sessões seguidas, não em simultâneo).

**Fora deste épico (fica no TASKS como futuro):** pré-visualização antes de publicar · histórico de versões no
servidor (o desfazer é só da sessão) · kit React/Next para outros sites · label "Ginásio (nomes)" (decisão pendente).
