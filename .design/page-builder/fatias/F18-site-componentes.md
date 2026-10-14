# F18 · winterplateau — Componentes e estilos da Winterplateau + especiais

**Repo:** winterplateau (branch `cms`) · **Tamanho:** L · **Depende:** F17 · **Agentes:** 1 Sonnet (+ o dono para D-D)
**Contrato:** §3.3, §4

## Objetivo
Os 25 componentes do núcleo com o aspecto da Winterplateau, os especiais (Edifício 3D, Faixa a passar) e os scripts
do site a funcionar com blocos que podem estar em qualquer ordem, repetidos ou ausentes.

## Passos
1. **D-D com o dono (antes de código):** o site tem 10 estilos de título (`stitle`, `otitle`, `ctitle`, `ab-title`,
   `stmt-h`, `cta-h`, `t-title`, `mtitle`, `dtitle`, `orc-title`) e o título gigante do topo, e 3 de botão (`btn-bl`,
   `btn-ow`, `btn-wol`). Propor: títulos **Destaque · Secção · Frase grande**; botões **Cheio · Contorno · Contorno
   claro**; textos **Normal · Introdução · Nota**; imagens **Normal · Cantos redondos · Largura total**; fundos
   **Claro · Escuro · Azul da marca**. Mostrar capturas e confirmar.
2. CSS dos componentes a partir de `src/styles/global.css` (consolidar, não duplicar); classes `c-<type>--<style>`.
3. Especiais: `edificio3d` (o SVG/animação actual do `Hero.astro`, com o texto vindo dos campos), `faixa`
   (o `Marquee.astro`, nomes dos campos).
4. Scripts (`public/scripts/home.js`, `public/assets/universe.js`, `marketing.js`): passar a módulos empacotados
   pelo Astro, **por instância** e tolerantes a blocos em falta (sem a Nav hoje dá TypeError a cada scroll);
   numeração "FL 01…", zig-zag e régua lateral calculados a partir da posição real dos blocos.
5. `formulario` → `POST /websites/leads` com `{name,email,phone,message,source}` e tratar a resposta (hoje qualquer
   resposta conta como sucesso).
6. `i18n.js` sai (as línguas são rotas).

## Brief para o agente (copiar)
> Implementa a fatia F18 (`Backoffice/.design/page-builder/fatias/F18-site-componentes.md`) passos 2–6, com os estilos
> decididos no passo 1 (estão no `TASKS.md` desta pasta). Componentes em `src/cms/components/`, especiais em
> `src/cms/specials/`. Responsivo (o site já é); acessível (alt, foco, contraste). Actualiza as fixtures para terem pelo
> menos um exemplo de cada componente e estilo, e o `scripts/check-build.mjs` para os verificar. ≤ 300 palavras.

## Revisão do supervisor
- [ ] **Olhar** para o site em 1440/834/390 com as fixtures (skill `run` ou `npm run preview` + capturas):
      cada componente e estilo, blocos repetidos, sem Nav, ordem trocada
- [ ] Nenhum `set:html` com texto da API fora de `text.ts`
- [ ] Orçamento do kit ≤ ~3 000 linhas

## Gates · Fecho
`CMS_FIXTURE=… npm run build && node scripts/check-build.mjs`. Commit no branch `cms` — **sem push** (PLANO §5). `TASKS.md`: F18 ✅.
