# Construtor de páginas — estado das fatias

> Fonte do épico. Plano: [PLANO.md](PLANO.md) · Contrato: [CONTRATO.md](CONTRATO.md) (v1 congelada, §11 = alterações).
> Ao começar uma fatia: 🔄. Ao acabar: ✅ + hashes. A parar a meio: **Retomar em:** com o passo exacto.
> O pormenor de cada fatia está na mensagem do commit (`git show <hash>`) — aqui só o essencial.

## ▶ Retomar aqui (sessão nova)

1. **F16** — ✅ fechada.
2. **Pequena mudança cross-repo** (nome do site, hora "No ar", línguas → publicação) — ✅ API `cb1f04b` ·
   BO `9ba1ebd` · winterplateau `3f5cde9` (`cms`). Contrato §11. e2e `paginas-admin` 13/13 nas 3 larguras.
3. ✅ **Push feito (2026-10-15)** — suites inteiras verdes (API 3 227 · BO e2e 314). API `cb1f04b` e Backoffice
   `9ba1ebd` LIVE (CI verde com deploy + smoke; migrações corridas no arranque). winterplateau: `cms` **e `main`**
   em `3f5cde9` (decisão do dono — DECISOES 2026-10-15; deploy `skipped` até ao A9).
   ~~**Suites inteiras dos três repos → push** (autorizado pelo dono): API → ver CI → Backoffice → ver CI →
   winterplateau **só o branch `cms`** (não juntar na `main` antes do conteúdo real estar na produção).~~
3b. ✅ **Configuração saiu do Admin (2026-10-16, pedido do dono)** — o construtor liga-se com `VIEW_SITE_PAGES`
   (sem *Activar*; coluna `enabled` removida) · API `d733671` `4527d7a` · BO `dafdba8` `ba57a0a`. Em Páginas →
   **Definições do site**: nome do site (o cliente edita); manifest e publicação só em sessão de suporte; publicação
   sempre GitHub (só o repo; `deploy.yml`/`main` e token global `GITHUB_DISPATCH_TOKEN` por omissão). Admin →
   Utilizadores já não tem o botão. e2e `paginas-definicoes` (substitui `paginas-admin`). Ver DECISOES 2026-10-16.
   Por decidir (menor): com repo gravado e sem publicações, o selo diz "Por configurar".
4. 🔄 **F19** — a parte do Claude está feita e no GitHub. **Agora: passos do dono em produção** (*Pendentes*), depois paridade visual e fecho.

| # | Fatia | Estado | Commits · essencial |
|---|---|---|---|
| F00 | Arranque | ✅ | BO `07ca4fa` |
| F01 | API · modelos, migração, purga, permissão | ✅ | API `17f58b3` · FKs RESTRICT; migração up/down provada |
| F02 | API · catálogo, manifest, validadores | ✅ | API `50cedfc` |
| F03 | API · leitura do editor + admin | ✅ | API `ee82767` · BO `1300015` |
| F04 | API · gravar páginas | ✅ | API `eb6b26a` · BO `0290573` |
| F05 | API · gravar blocos + pentest | ✅ | API `ed0b178` · BO `a9229d5` · 0 brechas entre tenants |
| F06 | API · objecto público + pentest | ✅ | API `0450290` · página só sai com as ascendentes publicadas; tecto 24 MB/413 |
| F07 | API · uploads de PDF | ✅ | API `5845f14` · BO `aa628b0` |
| F08 | API · publicação (GitHub) | ✅ | API `cc8fb50` · BO `18878a4` · 5 brechas corrigidas no pentest |
| F09 | API · fecho, contrato congelado | ✅ | API `8891bb4` · API ~3 550 linhas (orçamento 3 000) |
| F10 | BO · base, estado, gravar | ✅ | BO `ccc7252` · API `b01a742` (seed) |
| F11 | BO · lista lateral | ✅ | BO `4f2d208` · um só `useSortable` |
| F12 | BO · conteúdo da página e paleta | ✅ | BO `3fc28f3` |
| F13 | BO · renderizador de campos | ✅ | BO `fcbffe4` · upload diferido no Guardar |
| F14 | BO · editor de bloco | ✅ | BO `329c48a` |
| F15 | BO · definições e SEO | ✅ | BO `be99d5d` · BO ~7 200 linhas (orçamento 5 000, tecto 10 000) |
| F16 | BO · admin + e2e (3 larguras) | ✅ | BO `9e6dc2d` · API `3e77c6c` (seed) · 755 unitários; e2e inteiro 310 + 1 instável alheio (chat); 2 bugs do e2e corrigidos |
| F17 | Site · kit Astro | ✅ | winterplateau `ad7e2ed` (branch `cms`) |
| F18 | Site · componentes e estilos | ✅ | winterplateau `4fcb871` + `928771d` (cores do site actual) · kit ~2 000 linhas |
| F19 | Go-live e fecho | 🔄 | API `48dc79f` · winterplateau `2c8cf33` `3da8e70` · à espera dos passos do dono em produção |

## Pendentes (para o F19 ou logo a seguir)

**Produção — passo-a-passo para o dono (F19).** A API e o BO já estão no ar com o construtor e as migrações
corridas; o importador e o conteúdo vão na imagem da API (`48dc79f`).
1. **Admin → Permissões:** dar `VIEW_SITE_PAGES` à role da Winterplateau — **é isto que liga o construtor**
   (não há botão *Activar* desde 2026-10-16).
2. **Admin → Utilizadores → Winterplateau → "Entrar como"** (sessão de suporte) → **Páginas → Definições do site:**
   Nome do site `Winterplateau` (o cliente também o pode mudar) · *Carregar manifest* (ficheiro
   `winterplateau/cms/manifest.json`, no GitHub, ou colar o JSON). Manifest e publicação só aparecem em suporte.
3. **Coolify → app da API → Terminal:**
   `pnpm import:site-pages --user <email da Winterplateau> --file scripts/data/winterplateau-import.json --dry-run`
   → tem de dizer "Tudo válido" (e listar os 8 ficheiros por carregar) → repetir **sem** `--dry-run`.
4. **Backoffice como Winterplateau → Páginas:** carregar o logo (`favicon.svg`) no topo, a imagem de partilha
   (`og-image.png`) no SEO, e no bloco Downloads um componente "documentos" com os 6 PDFs (descarregá-los antes do
   WordPress antigo: `DECLARACAO_DESEMPENHO`, `declaracao-conformidade`, `dop`, `modo-de-aplicacao-molduras`,
   `WINTERPLATEAU_Catalogo-XS_AF`, `catalogo-rodatetos-winterplateau_Versao-1`). Ler a Privacidade EN/FR (Claude).
5. **Token da plataforma (uma vez para todos os sites):** GitHub → token fine-grained, Actions: write, só nos repos
   dos sites → Coolify → app da API → env `GITHUB_DISPATCH_TOKEN` → redeploy.
   Depois, em sessão de suporte, **Páginas → Definições do site → Publicação:** repositório
   `ruiffpereira/winterplateau` (workflow `deploy.yml`, branch `main` e token já vêm por omissão) → *Testar*.
6. **A9 — ligar o deploy do site** (GitHub → winterplateau → Settings → Secrets and variables → Actions):
   secrets `WIREGUARD_CONFIG`, `COOLIFY_DEPLOY_HOOK`, `COOLIFY_TOKEN` e a variável `DEPLOY_ENABLED=true`. No Coolify a
   app do site usa as envs de sempre (`VITE_API_BASE_URL`, `SITE_TOKEN`, `CF_BYPASS_TOKEN`).
7. Mudar um texto no Backoffice → Guardar → "A publicar…" → "No ar · hh:mm" e o site mostra-o (prova ponta-a-ponta).
   Depois Claude faz a paridade visual (3 larguras × PT/EN/FR) e fecha o épico.

**F19 — feito por Claude (2026-10-15):** importador `scripts/importSitePages.ts` + conteúdo real (API `48dc79f`;
9 páginas, 45 blocos, PT/EN/FR completos — Privacidade EN/FR traduzida por Claude, a rever pelo dono; ~43 KB por
língua) · manifest final sem o botão `claro` · endereços antigos tratados pelo kit (`/Projetos.html` → `/obras`,
`/Projeto.html?obra=` → `/obras/<slug>`, `/privacidade.html` → `/privacidade`) · site antigo apagado do winterplateau
(`2c8cf33`, `3da8e70`, na `main`) · `deploy.yml` já tinha `concurrency`. Suite e2e inteira do BO: 314 verdes (o
`paginas-ux` instável não repetiu).
**F19 — falta (depois dos passos do dono):** paridade visual com o site antigo (1440/834/390 × PT/EN/FR) e fecho do
épico (DECISOES, TASKS da raiz → `docs/5 - Historico/5.1 - tarefas feitas.md`, `CLAUDE.md` da raiz, `FUNCIONALIDADES.md`). Fora do épico:
o `src/gen` do booking do winterplateau está desactualizado; o repo não tem `user.name` (commits com `-c user.name=Rui`).

**Lacunas conhecidas (aceites, sem fatia):**
- Endereços antigos são **só leitura** no BO (a API cria-os e apaga-os sozinha; o dono concordou que não faz falta remover).
- `MANIFEST_IN_USE` não cobre mudanças nas partes/especiais (o save seguinte dá 422 a apontar o componente).
- `websiteDomain` validado só pelo nome (só o admin o define).
- O limitador de "Publicar agora" corre antes das validações (um 409 gasta o minuto).
- e2e não cobre "Testar" nem "Publicar agora" em modo GitHub (falariam com o GitHub a sério).

## Decisões tomadas durante a execução (também no `DECISOES.md` da raiz)
- **2026-10-14 · D-A** textos em JSON nas tabelas do construtor · **D-B** publicação pelo `workflow_dispatch` do
  GitHub · **D-C** menu "Páginas" · **D-D** estilos: títulos Secção · Destaque · Frase grande; botões Cheio ·
  Contorno; textos Normal · Introdução · Nota; imagens Normal · Cantos redondos · Largura total; fundos Claro ·
  Escuro · Azul da marca.
- **2026-10-14 · Meta = local** (o épico fecha a funcionar no PC de casa) · F17–F18 em paralelo com o BO (outro repo).
- **2026-10-15** · cores da Winterplateau como no site actual (não o tom AA) · sem banner de cookies (só Umami) ·
  push autorizado a Claude, com vigilância do CI · nome do site, hora "No ar" e línguas → publicação: fazer.
