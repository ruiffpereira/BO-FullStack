# Design Review: Dashboard vertical-aware

Reviewed against: `.design/dashboard-vertical/DESIGN_BRIEF.md`
Philosophy: Dieter Rams / funcionalista (sistema do admin existente)
Scope: `src/pages/Dashboard.tsx` (reescrita completa)

## Screenshots Captured

Capturados via **Playwright MCP** contra o dev (`localhost:5173`), tenant `Admin` (agenda+ginásio+loja). As espinhas de **ginásio** e **loja** foram capturadas forçando temporariamente `spine` (revertido logo a seguir via `git checkout` — o Admin tem todas as permissões, por isso a agenda ganharia sempre a espinha).

| Screenshot | Breakpoint | Mostra |
| --- | --- | --- |
| `screenshots/review-mixed-admin-desktop-1280.png` | Desktop 1280 | **Misto** (agenda+gym+loja): KPIs equilibrados (Receita hoje · Marcações hoje · **Por cobrar €75** · Vendas hoje), espinha "Hoje", carril com estado do mês + **GymMiniCard** |
| `screenshots/review-mixed-admin-mobile-375.png` | Mobile 375 | Mesma vista, coluna única, KPIs 2×N, sem overflow |
| `screenshots/review-gym-spine-desktop-1280.png` | Desktop 1280 | **Espinha de ginásio**: "Cobranças · julho", progresso €0/€75, Por cobrar/Em atraso/MRR, estado positivo "Tudo em dia ✓" |
| `screenshots/review-loja-spine-desktop-1280.png` | Desktop 1280 | **Espinha de loja**: banner "Tudo despachado" + Vendas de hoje, "Últimas encomendas" (estado vazio) |

> Verificado: render limpo (os 2 erros de consola são `csrf-token`/`users/refresh` 401, **pré-login**, não do dashboard). As 3 espinhas renderizam com dados reais; KPIs equilibrados sem o corte `slice(0,4)`; estados vazios positivos; dark mode coerente; mobile sem overflow.

## Summary

A reescrita cumpre o objetivo central do brief: o Dashboard deixa de assumir "negócio de marcações" e **compõe-se a partir das permissões do tenant** — espinha operacional escolhida por prioridade (agenda → ginásio → loja → core), KPIs com âncora por vertical + "Receita de hoje" agregada (corrige o bug do `slice(0,4)` que cortava a loja), e carris de apoio para as outras verticais. Tudo reutiliza as primitivas existentes (`Card`/`Badge`/`EmptyState`/`SectionTitle`/`Icon`/`Sparkline`/`BADGE_TONES`/`accent`) e os endpoints que já existem (`/api/dashboard?period=today`, `/gym/mensalidade/finance`). `tsc --noEmit` passa e a vista foi **validada visualmente** (Playwright MCP) nas 3 espinhas (agenda/ginásio/loja) + mobile — render limpo, sem must-fix.

## Must Fix

_Nenhum._ Sem erros de tipo, sem botões aninhados (os cartões/linhas clicáveis são `<button>` irmãos das ações, nunca encaixados), heading order correto (`h1` data → `h2` secções), sem cores/fontes fora do sistema.

## Should Fix

1. ~~**Validação visual pendente**~~ — **Feito** (Playwright MCP, ver "Screenshots Captured"): as 3 espinhas + mobile renderizam corretamente com dados reais.
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

## Verificação visual (feita)

Confirmado em `localhost:5173` (tenant `Admin`, agenda+gym+loja):
- **Agenda** (espinha real): "Hoje" timeline + próximo + marcador "agora"; carril com estado do mês + GymMiniCard. ✓
- **Ginásio** (espinha forçada p/ preview): "Cobranças · julho", progresso €0/€75, Por cobrar/Em atraso/MRR, "Tudo em dia ✓". ✓
- **Loja** (espinha forçada p/ preview): "Tudo despachado" + Vendas de hoje + "Sem encomendas". ✓
- **Misto** (KPIs): Receita hoje agregada · Marcações hoje · Por cobrar (gym) · Vendas hoje — **sem corte arbitrário**. ✓
- **Mobile 375**: coluna única, KPIs 2×N, sem overflow. ✓

_Não capturado (sem tenant dedicado): gym-only/loja-only com a sidebar reduzida e dados densos (em atraso/encomendas reais)._
