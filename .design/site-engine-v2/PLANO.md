# Site-engine v2 — plano

Decidido pelo dono a 2026-09-29 (ver [DECISOES](../../../DECISOES.md)). Fases no [TASKS](../../../TASKS.md) (B34).

## Porquê

O `site/` do site-engine tem ~21 000 linhas, mais ~6 000 de CSS, para reproduzir um site — o
tifas-barber — que no original tem **~4 200**. Blocos configuráveis, CMS por sobreposição e tema
em CSS próprio tornaram o código difícil de ler até para o dono. Refaz-se simples.

## O que muda

| | Hoje | Depois |
|---|---|---|
| Verticais | agenda, loja, gym | **agenda e gym**. A loja é apagada (fica no git) |
| Páginas | lista de blocos configurável no Backoffice | **páginas fixas**, em JSX, por vertical |
| Agenda | reinterpretação do tifas em blocos | **transplante do tifas-barber** (`D:/Projetos/Nova pasta/tifas-barber`): mesmos ficheiros, mesmas classes |
| Textos | `site.<bloco>.<campo>` sobreposto aos blocos + 25 famílias de labels com fallback | **chaves simples** lidas por `t(key)`, como no tifas e no gym. Defaults PT/EN em JSON na API |
| Tema | presets + accent + CSS por vertical (~6 000 linhas) | **cores da paleta Tailwind**: `principal` + `neutra` + `modo` + `letra` |
| Letras | 10 famílias do Google descarregadas no build | poucas, **guardadas no repo** (`next/font/local`) — resolve o B33 |
| Código | genérico, muitas camadas | **júnior**: óbvio, pouco abstraído, comentários curtos |

## O tema

O tenant escolhe no Backoffice:

- **principal** — uma cor da paleta Tailwind (`red`, `emerald`, `sky`…): botões, destaques.
- **neutra** — `slate`, `gray`, `zinc`, `neutral` ou `stone`: fundo, cartões, texto, linhas.
- **modo** — claro ou escuro.
- **letra** — uma de poucas opções.

O servidor converte a escolha em variáveis CSS (a partir de `tailwindcss/colors`). O tifas fica com
`principal: red`, `neutra: zinc`, `modo: escuro`, letra Plus Jakarta Sans — as cores Tailwind mais
próximas das dele (decisão do dono: só paleta, não hex livre).

### Requisito do dono: mudar o tema muda TUDO

Textos, ícones, fundos, cartões, bordas, contorno de foco, campos, hover, desactivado, gráficos do
gym — tudo acompanha. Como se garante:

- **Nenhum componente escolhe uma cor.** Usa um **papel**, e o tema decide o que cada papel vale:

  | Papel | Uso |
  |---|---|
  | `fundo` · `superficie` | página · cartões, modais, menus |
  | `texto` · `texto-suave` | texto normal · secundário |
  | `borda` | bordas, divisórias, contorno de campos |
  | `principal` · `principal-texto` | botões, links, ícones de destaque · texto em cima deles |
  | `foco` | contorno de navegação por teclado |
  | `perigo` · `sucesso` | erros · confirmações (fixos, fora da escolha do tenant) |

  Escreve-se `bg-superficie border-borda text-texto`, nunca `bg-zinc-900` nem `#202028`. Ícones
  com `currentColor`, para herdarem a cor do texto.
- **Teste que proíbe cores directas** (`text-white`, `border-gray-200`, `#hex`…) no código da agenda
  e do gym — é o que impede um pormenor de ficar com a cor antiga.
- **Contraste calculado**: `principal-texto` é branco ou preto conforme a cor principal, para
  cumprir WCAG AA (um amarelo leva texto preto).
- **Claro e escuro saem das mesmas escolhas**: escuro usa os tons 900–950 da neutra no fundo,
  claro os 50–100.
- **Olhar antes de fechar a fase**: capturas em 3–4 temas, claro e escuro. Os testes não vêem cor.

## Fases

| # | Fase | Repos | Nota |
|---|---|---|---|
| 1 | **Tema**: tipo novo do `Site.theme` validado na API; variáveis CSS no site-engine; letras locais; aba Tema no Backoffice; a app do gym deixa o verde fixo | os três | resultado visível logo, no gym |
| 2 | **Textos**: defaults `agenda.pt/en.json` na API a partir do `cms-translations.csv` do tifas (as chaves dele ficam como estão — o JSX transplantado usa-as sem mudar); semear por template no registo; script para o tenant tifas (dry-run primeiro, o dono corre) | API | ver se o tenant tifas já tem estas chaves (o antigo `migrate-cms-tifas.mjs` escrevia-as) |
| 3 | **Agenda nova**: `site-engine/agenda/` com o JSX do tifas, cada página uma rota do Next (para o Google ler o texto). Reaproveita o que é da plataforma: tenant por host, proxy `/api/site`, sessão em cookie, hooks Kubb. **Mesmos URLs** que o tifas tem hoje | site-engine | o tifas é cliente real: validar com os dados dele em `/preview` antes de trocar |
| 4 | **Gym**: a app do sócio lê o tema novo e os textos pelo mesmo `t(key)` | site-engine | a `gym/` já é o transplante do gymnoprado — não se copia outra vez |
| 5 | **Backoffice**: página Site passa a Tema + Domínio/Publicar; sai o editor de blocos (`blockCatalog`, `PageBlocksSection`…) | Backoffice | |
| 6 | **Limpeza**: apagar blocos, labels, CSS antigo, loja (site-engine, API, registo, Backoffice), `flattenSiteText`/`siteCms` de blocos, testes que os fixam; migração que retira `pages`/`nav`/`footer` do `Site`; actualizar `CLAUDE.md`, `MAPA`, `ARQUITETURA` | os três | só depois de a agenda nova estar no ar |

## Riscos

- **O tifas está no ar.** A troca da fase 3 não pode mudar URLs nem perder textos editados por ele.
- **Chaves de CMS são texto**: uma chave mal escrita dá texto vazio sem erro nenhum. Um teste
  compara as chaves usadas no JSX com as do JSON de defaults.
- **O gymnoprado está no ar.** As fases 1 e 4 tocam na app — olhar no telemóvel, não só nos testes.
- **Drift de variáveis CSS** entre o `tailwind.config.ts` e o CSS já tirou um site do ar. O teste
  `themeVars.test.ts` passa a guardar o tema novo.

## Fica de fora (por agora)

Loja · secções ligáveis/desligáveis · design novo · cor livre em hex.
