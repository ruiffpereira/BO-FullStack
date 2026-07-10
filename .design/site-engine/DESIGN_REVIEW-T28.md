# T28 — Design review visual do renderer (1.ª passagem, demo site)

**Data:** 2026-07-10 · **Método:** site-engine `next dev` local (porta 3210, demo site "Barbearia Demo" — a API desligada faz o renderer cair no `DEMO_SITE`), capturas Playwright headless em desktop (1440×900) e mobile (390×844), fullPage, das rotas `/`, `/inscrever`, `/entrar`, `/conta`. **Zero erros/warnings de consola em todas as páginas/viewports.**

## Veredicto geral

O renderer aguenta-se bem numa passagem visual completa: hierarquia tipográfica consistente (serif display + sans de apoio), ritmo vertical regular entre blocos, o preset `ink` monocromático lê-se intencional, mobile empilha sem overflow horizontal em nenhuma secção, e os blocos funcionais (booking com form real, pricing com badge "Popular", FAQ acordeão, contactos com form de lead) estão visualmente coerentes entre si. Nada de bloqueante encontrado.

## Findings

| # | Severidade | Finding | Nota |
|---|-----------|---------|------|
| 1 | — (falso alarme) | Caixas brancas nos blocos About/galeria no primeiro screenshot | Artefacto de fullPage + `loading=lazy` (imagens abaixo do fold não carregam em captura). Com scroll prévio, tudo carrega. A caixa do bloco Contact é o iframe do mapa (`mapEmbedUrl`, allowlist http(s)) — iframes de mapas não renderizam em headless. **Nenhuma ação.** |
| 2 | Should (futuro) | `/inscrever` tem copy de ginásio ("o ginásio entra em contacto") numa rota fixa que existe em TODAS as verticais — um site de barbearia/loja tem a página alcançável por URL direto, embora nunca linkada | Aceitável v1 (mesmo precedente de `/loja` em sites sem ecommerce). Melhoria futura: 404/redirect quando o site não tem bloco `gym`, ou copy neutra por vertical |
| 3 | Nota honesta | `/entrar` e `/conta` no demo mostram a sentinela "Site de demonstração — a conta fica disponível no site publicado" (correto — o demo não tem tenant real). **A UI real de auth + conta (marcações/encomendas) fica por provar visualmente** — precisa de um tenant vivo com dados | Fazer na prova real pós-Umami ou nos e2e do site-engine (dívida 5.3) |
| 4 | Could | Cookie banner (fixed, bottom) sobrepõe o form do `/inscrever` no primeiro paint em desktop até ser aceite/recusado | Comportamento normal de banner fixed; só notar que em páginas curtas tapa mais % do ecrã em mobile |

## O que esta passagem NÃO cobre (pendente do T28 completo)

- **Migrar o tifas-barber como prova real** — site completo de produção no renderer (precisa de dados/tenant reais).
- Os outros 3 templates de vertical (gym/loja/generic) — esta passagem usou o demo (barber-like). As variantes de bloco não usadas pelo demo ficaram por ver.
- Auth/conta com sessão real (finding 3).

Capturas em `scratchpad` da sessão (não versionadas — refazer é 1 script Playwright, ver histórico da sessão 2026-07-10).
