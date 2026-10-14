# F11 · Backoffice — Lista lateral: páginas, blocos, partes comuns

**Repo:** Backoffice · **Tamanho:** M · **Depende:** F10 · **Agentes:** 1 Sonnet
**Contrato:** §1, §6.3, §6.7 · **Protótipo:** coluna da esquerda (grupos, árvore, pastas, arrastar)

## Objetivo
A coluna da esquerda completa, com **um único** componente de lista ordenável usado em todo o construtor.

## O que tem de fazer
- **`components/SortableList.tsx` / `SortableTree.tsx`** (em `src/pages/paginas/components/`): dnd-kit com
  `PointerSensor` + `TouchSensor` (toque longo) + `KeyboardSensor` (Espaço + setas); pega ⋮⋮ igual em todo o lado;
  linha azul antes/depois; contorno tracejado para "meter dentro" (só na árvore e nas pastas). **Sem setas ↑↓**.
  Este componente é reutilizado no F12 (itens da página), F13 (itens de listas) e F14 (componentes).
- **Grupos** Páginas · Blocos · Partes comuns: abrem/fecham e arrastam-se; ordem e abertos guardados em
  `localStorage` (com `try/catch` — conveniência por pessoa, não dados).
- **Páginas** em árvore: arrastar para antes/depois/dentro; regras do §6.3 já no cliente (sem ciclos; a home fica no
  primeiro nível e não recebe filhas); "+" na linha cria subpágina; "Nova" cria página de primeiro nível com os
  blocos que estão em todas as páginas; seta abre/fecha filhas; rascunho com selo.
- **Blocos**: pastas (criar com nome em edição, renomear clicando, apagar só vazias, arrastar), blocos dentro e fora,
  pesquisa por nome, "Novo" (abre a paleta de blocos — o F12 faz a paleta; aqui só o botão).
- **Partes comuns**: Topo e Rodapé (sem arrastar).
- **Bolinhas amarelas** (traduções em falta) em grupos, páginas (e na mãe se a filha falha e está fechada), pastas,
  blocos e partes — a partir de `state/missing.ts`.
- **Telemóvel (< 860):** a lista é o primeiro ecrã; escolher uma página passa para o centro.

## Brief para o agente (copiar)
> Implementa a fatia F11 (`Backoffice/.design/page-builder/fatias/F11-bo-lista-lateral.md`), secção "O que tem de
> fazer", com o protótipo `Backoffice/.design/page-builder/prototipo.html` como referência visual (abre-o no browser;
> **não** copies o código dele — é JS solto de protótipo). dnd-kit já está instalado (exemplo de uso em
> `src/pages/Ginasio.tsx:220-250`). Todas as alterações passam pelo reducer do F10 (para entrarem no desfazer).
> Primitivas de `ui.jsx`; alvos de toque ≥ 40 px; em `hover:none` as acções ficam visíveis.
> Testes unitários das operações de árvore (mover antes/depois/dentro, recusa de ciclo, home) e de pastas.
> `pnpm lint` e `pnpm test:unit` verdes. Relatório ≤ 300 palavras.

## Revisão do supervisor
- [ ] Um só componente de ordenar (procurar `useSortable` no diff: só dentro de `SortableList/Tree`)
- [ ] Arrastar com teclado funciona (testar à mão uma vez)
- [ ] Capturas nas três larguras (Playwright `page.screenshot`) e olhar para elas

## Gates · Fecho
`pnpm lint && pnpm test:unit`. Commit — **sem push** (PLANO §5). `TASKS.md`: F11 ✅.
