# F14 · Backoffice — Editor de bloco, componentes, partes e especiais

**Repo:** Backoffice · **Tamanho:** L · **Depende:** F12, F13 · **Agentes:** 1 Sonnet
**Contrato:** §1, §3, §4, §6.7 · **Protótipo:** editor de um bloco (caminho, componentes, estilos, "Onde fica"), editor do Topo/Rodapé

## O que tem de fazer
- **Caminho** no topo: "‹ <página> › <bloco>" (volta à página) · "N de M" · bloco anterior/seguinte ·
  selo "SEO NN" da página (actualiza enquanto se escreve; abre Definições e SEO).
  Vindo da lista de Blocos: "‹ Voltar à página" e secção **"Onde é usado"** (páginas clicáveis; cadeado "não se apaga
  enquanto estiver em uso").
- **Bloco**: nome ("só para si"), fundo (do manifest), disposição 1/2/3 colunas (reduzir colunas reposiciona
  componentes), âncora (avançado; gerada do nome, única).
- **Componentes**: lista ordenável (`SortableList`) de linhas que abrem/fecham; cada linha com ícone, tipo, estilo,
  selo H1/H2 nos títulos, "Toda a largura/Coluna N", falta EN…, resumo; aberta mostra **Estilo** (cartões com amostra
  e o nome do manifest), **Onde fica** (se >1 coluna), os campos (`FieldRenderer` do F13), Duplicar, Apagar (confirmação).
- **Paleta de componentes** com separadores **Componente novo** (grupos do núcleo; no Topo/Rodapé só os permitidos)
  e **Copiar um que já existe** (todos os componentes de todos os blocos e partes, com pesquisa). Um componente novo
  traz os valores por omissão do catálogo (ex.: título nasce H2).
- **Topo e Rodapé**: mesmo editor, sem nome/âncora; topo sem disposição/fundo; só componentes permitidos.
- **Especiais**: editor com os campos do manifest (`FieldRenderer`), sem estilos nem componentes.
- Rodapé do editor: Esconder aqui · Duplicar bloco · Retirar desta página (vindo de uma página) **ou** Duplicar ·
  Apagar bloco (vindo da biblioteca; desactivado com cadeado se estiver em uso).
- Aviso "Este bloco está em N páginas — o que mudar aqui muda em todas".

## Brief para o agente (copiar)
> Implementa a fatia F14 (`Backoffice/.design/page-builder/fatias/F14-bo-editor-bloco.md`) com o protótipo como
> referência. Reutiliza `SortableList` (F11), `BlockThumb` (F12) e `FieldRenderer` (F13). Tudo pelo reducer.
> Estilos, fundos e componentes permitidos vêm do manifest/catálogo do `GET` — nada fixo no código.
> Responsivo nas três larguras (no telemóvel o editor ocupa o ecrã e o caminho é o "voltar").
> Testes unitários: mudar disposição reposiciona colunas; copiar componente gera ids novos; apagar bloco em uso
> desactivado; paleta do topo só com os permitidos. ≤ 300 palavras.

## Revisão do supervisor
- [ ] Orçamento do BO ainda ≤ ~5 000 linhas em `src/pages/paginas/**`
- [ ] Capturas nas três larguras de: bloco com 2 colunas, Topo, especial, paleta

## Gates · Fecho
`pnpm lint && pnpm test:unit`. Commit — **sem push** (PLANO §5). `TASKS.md`: F14 ✅.

## Se a sessão estiver a ficar sem contexto
Corte: (1) caminho + bloco + linhas de componentes + campos → commit; (2) paletas + partes + especiais.
