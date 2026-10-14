# F13 · Backoffice — Renderizador de campos (catálogo → formulário)

**Repo:** Backoffice · **Tamanho:** M · **Depende:** F10 · **Agentes:** 1 Sonnet
**Contrato:** §3.1, §3.3, §4 · **Protótipo:** formulário de um componente aberto (traduções lado a lado, imagem por língua, listas, "Leva para")

## Objetivo
Um componente `FieldRenderer` que desenha **qualquer** campo do catálogo ou de um especial a partir da definição
que vem da API. Nenhum formulário escrito à mão por tipo de componente.

## O que tem de fazer (um sub-componente por tipo de valor)
- **text / md com `i18n`**: uma caixa por língua do tenant (base primeiro), selo da língua, amarelo + "Por traduzir"
  quando falta; contador "N por traduzir"; `md` com barra Negrito · Itálico · Lista que actua na caixa com foco.
- **text / md sem `i18n`**: uma caixa, "Igual em todas as línguas".
- **choice**: botões segmentados (≤ 5 opções) ou `Select`.
- **media**: "A mesma em todas as línguas" (por omissão) ou uma por língua; upload com o `FileUpload` existente
  (imagem; PDF quando o campo é `file` — depende do F07); "Por carregar" a amarelo.
- **dest**: `Select` com Páginas · Secções (blocos com âncora) · Documentos · "Outro endereço…" (caixa com validação
  `https:/http:/mailto:/tel:`).
- **pages**: lista de páginas com caixas de seleção e máximo; rascunhos assinalados.
- **list**: itens que abrem/fecham, ordenáveis (`SortableList`), "Adicionar …", remover (respeita `min`).
- Campos `seo` agrupados numa caixa "Google (SEO)" no fim.
- Mostrar os `issues` do último `422` no campo certo (pelo `path`).

## Brief para o agente (copiar)
> Implementa a fatia F13 (`Backoffice/.design/page-builder/fatias/F13-bo-campos.md`). O renderizador recebe
> `(fieldDef, value, onChange, ctx)` onde `ctx` tem línguas, base, páginas, blocos com âncora e `issues`. Todas as
> mudanças passam pelo reducer com uma chave de junção por campo (para o desfazer não ir letra a letra).
> Primitivas de `ui.jsx`; `FileUpload` existente; responsivo (no telemóvel as línguas ficam empilhadas).
> Testes unitários por tipo de valor (render + alteração + estado "falta tradução"). ≤ 300 palavras.

## Revisão do supervisor
- [ ] Nenhum `if (type === 'titulo')` no renderizador — só tipos de valor
- [ ] Línguas vêm do tenant (nunca `pt/en/fr` fixos)

## Gates · Fecho
`pnpm lint && pnpm test:unit`. Commit — **sem push** (PLANO §5). `TASKS.md`: F13 ✅.
