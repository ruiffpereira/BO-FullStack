# Construtor de páginas — estado das fatias

> Fonte do épico. Plano: [PLANO.md](PLANO.md) · Contrato: [CONTRATO.md](CONTRATO.md) (v1 congelada, §11 = alterações).
> Ao começar uma fatia: 🔄. Ao acabar: ✅ + hashes. A parar a meio: **Retomar em:** com o passo exacto.
> O pormenor de cada fatia está na mensagem do commit (`git show <hash>`) — aqui só o essencial.

## ▶ Retomar aqui (sessão nova)

1. **F16** — ✅ fechada.
2. **Pequena mudança cross-repo** (nome do site, hora "No ar", línguas → publicação) — ✅ API `cb1f04b` ·
   BO (este commit) · winterplateau `3f5cde9` (`cms`). Contrato §11. e2e `paginas-admin` 13/13 nas 3 larguras.
3. **Suites inteiras dos três repos → push** (autorizado pelo dono): API → ver CI → Backoffice → ver CI →
   winterplateau **só o branch `cms`** (não juntar na `main` antes do conteúdo real estar na produção).
4. **F19** — importador do conteúdo real (Claude), manifest final, paridade, e o passo-a-passo do dono em produção.

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
| F19 | Go-live e fecho | ⬜ | |

## Pendentes (para o F19 ou logo a seguir)

**Produção — passo-a-passo para o dono** (escrever no F19): o push da API faz o deploy e **as migrações correm
sozinhas** no arranque (agora duas: `20261014120000` e `20261015120000`); no admin de produção: dar `VIEW_SITE_PAGES`
à role da Winterplateau, activar o construtor, **pôr o nome do site**, carregar o manifest final.

**Antes do push:** o winterplateau tem `src/gen/` (booking) regenerado por engano no disco, fora dos commits —
descartar (`git checkout -- src/gen && git clean -fd src/gen`). O `paginas-ux` "(1) arrastar com o teclado" deu
timeout a 834/390 só na corrida longa dos `paginas-*` (isolado passa) — ver se repete na suite inteira. O A9 (secrets do deploy do winterplateau) fica para o fim de tudo.

**F19 — site e conteúdo:**
- Importador do conteúdo actual da Winterplateau para o construtor (Claude), testado na API local; paridade com o
  site actual; < 300 KB por língua.
- Manifest final: tirar o estilo de botão `claro`.
- Confirmar os endereços antigos (`/Projetos.html`, `/Projeto.html?obra=`, `/privacidade.html`) contra o código da `main`.
- Arrumar o winterplateau: apagar `src/components/*`, `global.css`, `BaseLayout.astro`, `projects.js`, `winter.css`;
  `src/gen` do booking desactualizado (não é do épico); o repo não tem `user.name` (commits com `-c user.name=Rui`).
- `deploy.yml` do winterplateau com `concurrency`.

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
