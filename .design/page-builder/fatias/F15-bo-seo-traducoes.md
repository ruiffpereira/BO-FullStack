# F15 · Backoffice — Definições e SEO, SEO do site, "Ver onde"

**Repo:** Backoffice · **Tamanho:** M · **Depende:** F14 · **Agentes:** 1 Sonnet
**Contrato:** §2 (SitePages.seo, slugs), §6.5, §7 (`alternates`), §9 · **Protótipo:** separador "Definições e SEO", janela "SEO do site", botão "Ver onde"

## O que tem de fazer
- **Separador "Definições e SEO"**: nome (por língua) · endereço na base com prefixo da mãe · endereços noutras
  línguas (vazio = usa a base) · **Endereços antigos** (redireccionam para aqui; remover um) · estado
  rascunho/publicada · secção Google (SEO): **pontuação 0–100** · **pré-visualização do resultado no Google**
  (título com " · <site>", endereço em migalhas, descrição; contadores 60/160) · lista de verificações (§9, as que
  falham primeiro) · palavras-chave por língua · título no Google · descrição · imagem ao partilhar · avançado
  (versão canónica) · aparecer no Google sim/não · bloco "não pode ser apagada enquanto…" com motivos clicáveis ·
  Apagar página. Tudo actualiza enquanto se escreve **sem perder o foco**.
- **`state/seo.ts`**: as verificações e a pontuação do §9, puras e testadas.
- **"SEO do site"** (botão no topo da página Páginas): pontuação de cada página com o primeiro problema, média, e a
  lista do que o site faz sozinho; clicar abre as definições da página.
- **"N por traduzir · Ver onde"**: leva ao próximo campo em falta (abre página/bloco/parte, abre o componente e os
  itens de lista necessários, foca a caixa). Guardar continua bloqueado até zero.
- Mostrar `issues` de `422` que sejam da página (slug repetido, etc.) nos campos.

## Brief para o agente (copiar)
> Implementa a fatia F15 (`Backoffice/.design/page-builder/fatias/F15-bo-seo-traducoes.md`) com o protótipo como
> referência. As verificações de SEO vivem em `src/pages/paginas/state/seo.ts` (puras) com testes de cada regra e da
> pontuação. Os redirects mostrados vêm do estado (`redirects` do `GET`); mudar o endereço só cria redirects no
> servidor ao gravar (mostrar "o endereço antigo vai continuar a funcionar" antes de gravar). Responsivo.
> ≤ 300 palavras.

## Gates · Fecho
`pnpm lint && pnpm test:unit`. Commit — **sem push** (PLANO §5). `TASKS.md`: F15 ✅.
