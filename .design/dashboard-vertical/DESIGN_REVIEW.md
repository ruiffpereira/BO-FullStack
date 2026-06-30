# Design Review: Dashboard vertical-aware

Reviewed against: `.design/dashboard-vertical/DESIGN_BRIEF.md`
Philosophy: Dieter Rams / funcionalista (sistema do admin existente)
Scope: `src/pages/Dashboard.tsx` (reescrita completa)

## Screenshots Captured

> ⚠️ **Não foi possível capturar screenshots da app a correr.** Não há browser MCP (Playwright/Cursor) disponível neste ambiente, e a infra e2e não arrancou: o MySQL de teste (`:3307`) está de pé, mas o utilizador `testuser` não tem acesso à BD `api_e2e` (`ER_DBACCESS_DENIED_ERROR` — grant em falta na BD de teste, fora do âmbito desta mudança). A review abaixo é **ao nível do código** contra o brief + checklist. Recomenda-se uma passagem visual manual (ver "Verificação pendente").

| Screenshot | Breakpoint | Estado |
| --- | --- | --- |
| — | Desktop 1280 | não capturado (sem browser tool / e2e DB) |
| — | Mobile 375 | não capturado |

## Summary

A reescrita cumpre o objetivo central do brief: o Dashboard deixa de assumir "negócio de marcações" e **compõe-se a partir das permissões do tenant** — espinha operacional escolhida por prioridade (agenda → ginásio → loja → core), KPIs com âncora por vertical + "Receita de hoje" agregada (corrige o bug do `slice(0,4)` que cortava a loja), e carris de apoio para as outras verticais. Tudo reutiliza as primitivas existentes (`Card`/`Badge`/`EmptyState`/`SectionTitle`/`Icon`/`Sparkline`/`BADGE_TONES`/`accent`) e os endpoints que já existem (`/api/dashboard?period=today`, `/gym/mensalidade/finance`). `tsc --noEmit` passa. Maior risco residual: ausência de validação visual (sem screenshots) — sobretudo das espinhas de **ginásio** e **loja**, que o seed e2e atual pode não exercitar.

## Must Fix

_Nenhum._ Sem erros de tipo, sem botões aninhados (os cartões/linhas clicáveis são `<button>` irmãos das ações, nunca encaixados), heading order correto (`h1` data → `h2` secções), sem cores/fontes fora do sistema.

## Should Fix

1. **Validação visual pendente** (ver secção própria). As composições de **gym-only** e **loja-only** nunca foram vistas a renderizar. _Fix: correr `pnpm dev` e abrir `/` com tenants de cada vertical (ou repor o grant de `api_e2e` e correr a captura e2e)._
2. **Deep-link por item em falta na Loja**: `OrdersList` e `StockAlerts` levam ao **separador** (`/loja?tab=encomendas` / `?tab=produtos`), não à encomenda/produto específico — a Loja não expõe `?openOrder=` e o `stockAlerts` da API não traz `productId`. Aceitável como v1, mas é meio-caminho face ao princípio "cada número é uma porta". _Fix (futuro): `?openOrder=<id>` na Loja + `productId` em `ecommerce.stockAlerts`._

## Could Improve

1. **`newCustomers` depende de `createdAt`** nas linhas de `/customers`. Se o campo não vier, o sub fica "no total" (degrada com honestidade, mas perde o sinal). _Sugestão: confirmar que `GetCustomers` devolve `createdAt`._
2. **`gymDerive` é chamado 2× por render** (no corpo + dentro do bloco). Custo desprezável; consolidável se quiser limpeza.
3. **Animação de entrada** da barra de progresso só transiciona em `width` ao mudar de valor; num carregamento direto pode não "crescer". _Sugestão: opcionalmente animar de 0 no mount._

## What Works Well

- **Composição por permissões é limpa e explícita**: uma variável `spine` + um array `rail[]` montado por flags. Fácil de ler e de estender (uma nova vertical = mais um ramo). Valida mentalmente bem para os 4 perfis e para combinações (agenda+loja+gym dá KPIs equilibrados, sem cortes arbitrários).
- **Reaproveitamento total do sistema visual** — zero componentes duplicados, zero valores hardcoded fora dos tokens; o `KpiCard` ganhou `href` clicável seguindo o mesmo padrão de afordância (hover `accent`, foco visível) da feature de notificações.
- **Acionável, não vaidade**: "Por despachar", "Em atraso", "Por cobrar", "Stock baixo" — métricas que pedem ação, cada uma com a sua porta. Estados vazios positivos ("Tudo em dia ✓", "Tudo despachado").
- **A11y cuidada**: cartões/linhas são `<button>` reais com `aria-label`, foco visível (`focus-visible:ring`), `motion-reduce` no marcador "agora", cor nunca é o único sinal (rótulo + número no "em atraso").

## Verificação pendente (passagem visual manual)

Para fechar a review com confiança, ver `/` a renderizar com, no mínimo:
- **Agenda** (tenant com `VIEW_SCHEDULE`): espinha = "Hoje" (timeline), carril = estado do mês.
- **Ginásio** (tenant com `VIEW_GYM`, sem agenda): espinha = "Cobranças · {mês}" (progresso + em atraso).
- **Loja** (tenant com `VIEW_PRODUCTS`, sem agenda/gym, ex.: `limited@e2e`): espinha = "Por despachar + últimas + stock".
- **Misto** (agenda+loja+gym): KPIs equilibrados, carris com mini-gym + encomendas + stock.
- **Mobile 375**: coluna única, KPIs 2×N, sem overflow horizontal.
