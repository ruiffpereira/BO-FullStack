# F05 · API — Gravar (2/2): blocos, pastas, partes, especiais, traduções

**Repo:** API-FullStack (+ `spec.json`) · **Tamanho:** L · **Depende:** F04
**Agentes:** 1 Sonnet · `seguranca-api` · `pentest-api` (fecha o isolamento do editor) · **Skill:** `endpoint-api`
**Contrato:** §5.2, §6 (todo), §3, §4

## Objetivo
O `save` passa a aceitar `blocks`, `folders` e `parts`, e os itens `special` validados contra o manifest. Com esta
fatia, a gravação fica completa e o editor pode ser construído.

## Acrescentar ao fluxo do F04
- Upsert/delete de **blocos** (componentes validados com `validateBlock` + manifest: tipo, estilo, `col ≤ layout`,
  campos, listas, `dest`, `pages`, media do tenant via `isOwnedUrl` — até ao F07 usar um stub que aceita o prefixo
  `<userId>/` do storage), **pastas** e **partes** (`topo`/`rodape` com os tipos permitidos de `manifest.parts`
  ou `PARTS_DEFAULT`).
- Protecções: `BLOCK_IN_USE {pages}`, `FOLDER_NOT_EMPTY`; âncoras únicas por tenant.
- `items` `kind:'special'`: `specialType` existe no manifest; `specialData` validado com os campos do especial.
- Varrimento final de **traduções** sobre tudo (páginas + blocos usados ou não + partes + especiais).
- Limites §6.8 (contar no estado final).

## Brief para o agente construtor (copiar)
> Continua o `POST /api/cms/site-builder/save` (ver F04 já feito). Implementa o que está em "Acrescentar ao fluxo" da
> fatia F05 com o CONTRATO §6, reaproveitando `src/pageBuilder/`. Remove o `422 NOT_YET`. Testes em
> `tests/backoffice/siteBuilderSaveBlocks.test.ts`: bloco com cada tipo do catálogo (um teste parametrizado);
> estilo inexistente → 422; `col:3` num bloco de 2 colunas → 422; apagar bloco em uso → 409 com páginas; partilhar o
> mesmo bloco em 2 páginas; especial desconhecido → 422; tradução em falta numa lista dentro de um componente → 422
> com `path` e `locale`; imagem de outro tenant → 422 `FOREIGN_MEDIA`; `dest.url` `javascript:` → 422; pasta não
> vazia → 409; topo com um componente não permitido → 422. Relatório ≤ 300 palavras.

## Brief para `seguranca-api`
> Mesma rota, agora com blocos/pastas/partes. Cobre: upsert de bloco com id de bloco do B; mover um bloco do A para
> uma pasta do B; referenciar página do B num `dest`/`pages`; âncora igual à do B (deve ser permitido: único por
> tenant); 40+ componentes; listas acima do máximo; JSON profundo/recursivo nos valores; strings de 5 MB.

## Brief para `pentest-api` (antes do commit)
> Tenants A (atacante) e B (vítima) reais na BD de teste, B com construtor activo e conteúdo. Ataca **todas** as rotas
> `/api/cms/site-builder*` e `/api/admin/users/:id/site-builder*` como A: ler, alterar ou apagar qualquer coisa do B,
> descobrir ids do B, escalar para admin, contornar o lock de revisão. Sucesso = encontrar uma brecha. Relatório com
> reprodução de cada achado.

## Revisão do supervisor
- [ ] Achados do pentest corrigidos (agente Sonnet) e re-testados antes do commit
- [ ] Um único varrimento de validação sobre o estado final (não validar só o que mudou)
- [ ] Orçamento da API ainda ≤ ~3 000 linhas

## Gates · Fecho
API gates + `pnpm kubb:refresh` no Backoffice. Commits — **sem push** (PLANO §5). `FUNCIONALIDADES.md` actualizado. `TASKS.md`: F05 ✅.

## Se a sessão estiver a ficar sem contexto
Corte: construtor + `seguranca-api` verdes → commit; `pentest-api` + correcções na sessão seguinte, e só então ✅.
