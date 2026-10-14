# Construtor de páginas — estado das fatias

> Fonte do épico. Plano: [PLANO.md](PLANO.md) · Contrato: [CONTRATO.md](CONTRATO.md).
> Ao começar uma fatia: 🔄. Ao acabar: ✅ + hashes. A parar a meio: **Retomar em:** com o passo exacto.

| # | Fatia | Estado | Commits / notas |
|---|---|---|---|
| F00 | Arranque: decisões, pendentes, CI do winterplateau | ✅ | BO `07ca4fa` ("Website", e2e conteudos+rbac 59 verdes). CI do winterplateau sem secrets → **A9** do TASKS da raiz (bloqueia só F17+) |
| F01 | API · modelos, migração, purga, permissão | ✅ | API `17f58b3` (suite 2080 verde, tsc). FKs RESTRICT; purga desliga `parentId` antes. Migração up/down provada só às tabelas novas (as antigas não correm do zero — o esquema nasce de `sync`) |
| F02 | API · catálogo, manifest, validadores | ✅ | API `50cedfc` (suite 2378 verde, tsc; 1 462 linhas). Leituras restritivas: topo só 1 coluna; SEO da página 120/320/300; `video.source` obrigatório; manifest só restringe as partes |
| F03 | API · leitura do editor + admin | ✅ | API `ee82767` · BO `1300015` (spec). Suite 2445 verde; seguranca-api +29, sem brechas. errorLogger: 413/400 do body-parser deixam de dar 500 (todas as rotas). `kubb:refresh` precisa da API de pé: usei a e2e (`VITE_API_BASE_URL=http://localhost:3002/api`) |
| F04 | API · gravar 1/2 (páginas) | ⬜ | |
| F05 | API · gravar 2/2 (blocos) + pentest | ⬜ | |
| F06 | API · objecto público + pentest | ⬜ | |
| F07 | API · uploads de PDF | ⬜ | |
| F08 | API · publicação | ⬜ | |
| F09 | API · fecho e contrato congelado | ⬜ | |
| F10 | BO · base, estado, gravar | ⬜ | |
| F11 | BO · lista lateral | ⬜ | |
| F12 | BO · conteúdo da página | ⬜ | |
| F13 | BO · renderizador de campos | ⬜ | |
| F14 | BO · editor de bloco | ⬜ | |
| F15 | BO · definições e SEO | ⬜ | |
| F16 | BO · admin + e2e (3 larguras) | ⬜ | |
| F17 | Site · kit Astro | ⬜ | |
| F18 | Site · componentes e estilos | ⬜ | Estilos D-D: _(preencher no F18)_ |
| F19 | Go-live e fecho | ⬜ | |

## Decisões tomadas durante a execução
- **2026-10-14 · D-A** textos em JSON nas tabelas do construtor (não `ContentEntry`) · **D-B** publicação pelo
  `workflow_dispatch` do GitHub · **D-C** menu "Páginas". (Também no `DECISOES.md`.)
- **D-D** estilos da Winterplateau: _(preencher no F18)_
