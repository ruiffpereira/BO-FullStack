# F12 · Backoffice — Centro: conteúdo da página e paleta de blocos

**Repo:** Backoffice · **Tamanho:** M · **Depende:** F11 · **Agentes:** 1 Sonnet
**Contrato:** §1, §3.3 (pontos de partida), §4 (`specials`) · **Protótipo:** centro, separador "Conteúdo"; janela "Adicionar bloco"

## O que tem de fazer
- **Cabeçalho da página** no centro: nome, endereço, estado, nº de blocos; separadores **Conteúdo** |
  **Definições e SEO** (com a pontuação — o conteúdo do segundo separador é do F15; aqui fica o separador e um
  marcador).
- **Separador Conteúdo**: Topo trancado em cima e Rodapé em baixo (cadeado, sem arrastar, clicáveis); entre eles a
  lista ordenável dos itens (`SortableList` do F11) — cada **bloco** com miniatura, nome, resumo dos componentes,
  selos (partilhado em N páginas · escondido aqui · falta EN…) e cada **especial** com o nome do manifest;
  "＋" entre itens e "Adicionar bloco" no fim; menu "⋯": Duplicar · Usar uma cópia só nesta página (só se partilhado)
  · Esconder/Mostrar nesta página · Retirar desta página (confirmação; o bloco fica na biblioteca).
- **Paleta "Adicionar"** com separadores: **Bloco novo** (pontos de partida do §3.3) · **Usar um que já existe**
  (partilhado) · **Copiar um que já existe** (cópia independente) · **Especiais deste site** (só se o manifest tiver).
- Clicar num bloco/especial/parte abre o editor (F14) — nesta fatia, um marcador com o nome.
- Selo "SEO NN/100" clicável no topo do separador (abre Definições e SEO).

## Brief para o agente (copiar)
> Implementa a fatia F12 (`Backoffice/.design/page-builder/fatias/F12-bo-conteudo-pagina.md`) com o protótipo como
> referência visual. Reutiliza `SortableList` do F11. A miniatura do bloco é gerada a partir dos componentes
> (disposição em colunas, fundo, um traço por componente) — componente `BlockThumb`. Todas as acções passam pelo
> reducer (desfazer). Responsivo nas três larguras. Testes unitários: duplicar (ids novos, componentes copiados),
> "cópia só nesta página", retirar (bloco continua na biblioteca), inserir na posição certa. ≤ 300 palavras.

## Revisão do supervisor
- [ ] "Usar" partilha (mesmo `blockId`); "Copiar" cria bloco novo com ids novos em tudo (componentes e itens de lista)
- [ ] Especiais só aparecem se `manifest.specials` existir
- [ ] Capturas nas três larguras

## Gates · Fecho
`pnpm lint && pnpm test:unit`. Commit — **sem push** (PLANO §5). `TASKS.md`: F12 ✅.
