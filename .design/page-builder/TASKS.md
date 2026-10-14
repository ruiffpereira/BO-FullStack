# Construtor de páginas — estado das fatias

> Fonte do épico. Plano: [PLANO.md](PLANO.md) · Contrato: [CONTRATO.md](CONTRATO.md).
> Ao começar uma fatia: 🔄. Ao acabar: ✅ + hashes. A parar a meio: **Retomar em:** com o passo exacto.

| # | Fatia | Estado | Commits / notas |
|---|---|---|---|
| F00 | Arranque: decisões, pendentes, CI do winterplateau | ✅ | BO `07ca4fa` ("Website", e2e conteudos+rbac 59 verdes). CI do winterplateau sem secrets → **A9** do TASKS da raiz (bloqueia só F17+) |
| F01 | API · modelos, migração, purga, permissão | ✅ | API `17f58b3` (suite 2080 verde, tsc). FKs RESTRICT; purga desliga `parentId` antes. Migração up/down provada só às tabelas novas (as antigas não correm do zero — o esquema nasce de `sync`) |
| F02 | API · catálogo, manifest, validadores | ✅ | API `50cedfc` (suite 2378 verde, tsc; 1 462 linhas). Leituras restritivas: topo só 1 coluna; SEO da página 120/320/300; `video.source` obrigatório; manifest só restringe as partes |
| F03 | API · leitura do editor + admin | ✅ | API `ee82767` · BO `1300015` (spec). Suite 2445 verde; seguranca-api +29, sem brechas. errorLogger: 413/400 do body-parser deixam de dar 500 (todas as rotas). `kubb:refresh` precisa da API de pé: usei a e2e (`VITE_API_BASE_URL=http://localhost:3002/api`) |
| F04 | API · gravar 1/2 (páginas) | ✅ | API `eb6b26a` · BO `0290573` (spec). Suite 2652 verde; seguranca-api +115, 1 achado (`parentId: ""` → 500) corrigido. **Para o F09:** `UUID_RE` aceita maiúsculas e os ids são `utf8mb4_bin` — o UUID do B em maiúsculas vira id novo do A (não toca no B); normalizar para minúsculas |
| F05 | API · gravar 2/2 (blocos) + pentest | ✅ | API `ed0b178` · BO `a9229d5` (spec). Suite 2900 verde. seguranca-api: 3 brechas corrigidas (JSON profundo e surrogates davam 500; `__proto__` contornava a validação — globais em `security.ts`). pentest-api: 0 brechas entre tenants; links `javascript:` em `md` corrigidos. **Orçamento da API: ~2 900 de ~3 000 linhas** com F06–F08 por fazer — vai passar, sem chegar ao dobro |
| F06 | API · objecto público + pentest | ✅ | API `0450290` (suite 3017 verde, build). Página só sai se ela **e todas as ascendentes** estão publicadas. seguranca-api +69: tipos `__proto__`/`constructor` da BD davam 500 → corrigido. pentest-api +14: amplificação de saída (187 MB com 12 páginas) → tecto de 24 MB e `413`; `Vary: x-site-token`. Spec do BO inalterado (só lê `controllers/backoffice`); o spec `site` é do winterplateau (F17). **Por provar no F19:** < 300 KB por língua com os dados reais. **Orçamento da API: ~3 100 linhas** (com @swagger) — passou os 3 000, longe do dobro |
| F07 | API · uploads de PDF | ✅ | API `5845f14` · BO (spec + `useUploadPdf`). Suite 3096 verde, build. `POST /uploads/pdf` só com bytes `%PDF-`, `Content-Type` fixo; `isOwnedUrl` em `src/utils/ownedMedia.ts` substitui o stub. seguranca-api +47: temporários além do 1.º ficavam no disco (nos 3 uploads) e `isOwnedUrl` aceitava invisíveis — corrigidos. `spec.json` gerado offline com `ts-node scripts/dumpSpec.ts backoffice` (o refresh pede a API de pé) |
| F08 | API · publicação | ✅ | API `cc8fb50` · BO (spec, 3 rotas). Suite 3187 verde (1.ª corrida: 1 falha não identificada que não se repetiu; os 91 testes da publicação 5×5 verdes). Sem coluna nova: revisão esperada = `revision`; 3 min de graça para o `cms-build.json`; 30 min → falhou; falha do dispatch não repete sozinha. seguranca-api +26 e pentest-api +22: 5 brechas corrigidas (prefixo do token em erros, tenant preso em `running` por revisão > INT ou run id inválido, `cms-build.json` sem tecto, corpo citado no erro, save no segundo do dispatch). ⚠ o pentest fez 2 chamadas reais ao GitHub com token falso (401) — testes agora falham em `fetch` não mockado. **Em aberto:** `websiteDomain` validado só pelo nome (DNS para IP interno = SSRF cego, só o admin define o domínio). **Para o F19:** `deploy.yml` com `concurrency` |
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
- **2026-10-14 · Meta = local.** O épico está terminado quando tudo funciona **no PC de casa** (API + Backoffice + winterplateau em local). O deploy (A9, push, CI, produção) fica para o fim e é do dono — não bloqueia F17–F19; o site prova-se com a API local ou `CMS_FIXTURE`.
- **D-D** estilos da Winterplateau: _(preencher no F18)_
