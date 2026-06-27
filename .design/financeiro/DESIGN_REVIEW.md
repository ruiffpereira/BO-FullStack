# Design Review: Financeiro (redesign)

Reviewed against: `.design/financeiro/DESIGN_BRIEF.md`
Philosophy: Calm financial dashboard (Stripe / Linear / Lemon Squeezy)
Date: 2026-06-27
Reviewer: revisão **ao nível do código** (sem screenshots — não havia browser/Playwright MCP no ambiente e o utilizador estava ausente).

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| ---------- | ---------- | ----------- |
| — | — | **Não capturados.** Sem ferramenta de browser disponível. Correr `/design-review` com o Backoffice (`pnpm run dev`, :5173) + API (:3001) a correr e dados/login válidos para a passagem visual (desktop 1280, tablet 768, mobile 375, dark mode). |

> A review abaixo cobre tudo o que se consegue avaliar lendo o código: hierarquia, consistência de tokens, qualidade de componentes, estados, responsivo, acessibilidade e fidelidade estética. O que exige olho (FOUT, overflow real, contraste renderizado, z-index) fica para a passagem visual.

## Summary

A implementação segue fielmente o brief: tabs por vertical *gated* por permissão, tríade Faturado/Recebido/Em dívida em todo o lado, lucro com COGS, nomes novos no lugar de "ticket médio", e um Score de saúde no consolidado. Reutiliza o design system existente (Card/Badge/Icon, paleta zinc, accent `#2A6FDB`, `tabular-nums`) e estende `charts.jsx` em vez de introduzir `recharts` — boa decisão de consistência. **A maior incoerência:** o toggle **c/IVA · s/IVA** aparece na tab *O Negócio* mas o endpoint `/financeiro/negocio` ignora o parâmetro `iva`, por isso ali o toggle não faz nada.

## Must Fix

1. ✅ **RESOLVIDO** — **Toggle de IVA sem efeito em "O Negócio"**: o `VatToggle` aparecia em todas as tabs mas o `/financeiro/negocio` ignora `iva`. _Aplicado: o toggle passa a aparecer só em Agenda/Loja (onde decompõe de facto); em O Negócio fica escondido._

## Should Fix

1. ⚠️ **PARCIALMENTE RESOLVIDO** — **Gráficos sem alternativa textual/acessível**: aplicado `role="img"` + `aria-label` ao `Heatmap` e ao `Waterfall`; o `DonutChart` já tem legenda textual visível (nome + %). _Falta ainda: tabela escondida com os valores exatos para leitores de ecrã._
2. **Dois `KpiCard` ainda coexistem**: o canónico em [kit.tsx](../src/components/financeiro/kit.tsx) e um local em [GymMensalidade.tsx](../src/pages/GymMensalidade.tsx) (`function KpiCard`) com API diferente (`hint`/`tone` vs `sub`/`icon`/`delta`). Funciona, mas é a duplicação que o brief queria eliminar. _Fix: migrar o `AnaliseView` para o `KpiCard` do kit e apagar o local._
3. **Heatmap pode rebentar em mobile**: tem `overflow-x-auto` (bom), mas com muitas horas o grid fica minúsculo a 375px. _Fix: limitar às horas de expediente ou permitir scroll com indicação visual._
4. **`BarChart` do funil com labels longos** ("Confirmadas", "Canceladas") pode sobrepor a 375px (viewBox fixo 560). _Fix: abreviar labels em mobile ou rodar._
5. **IVA da agenda usa a taxa atual do serviço, não snapshot**: `agendaController` resolve `vatRate` via `Service` atual; se o tenant mudar a taxa, o histórico recalcula. _Aceitável e documentado, mas convém registar `vatRate` no snapshot da marcação no futuro (como `servicePrice`)._

## Could Improve

1. **Animação de entrada dos KPIs/score**: o brief pede `prefers-reduced-motion`; o `HealthScore` anima o anel (`transition`) mas não há guarda de reduced-motion. _Sugestão: `motion-reduce:transition-none`._
2. **Tooltip dos gráficos caseiros**: `AreaChart` tem hover; `Waterfall`/`Heatmap` só têm `title` nativo (atraso do browser). _Sugestão: tooltip consistente._
3. **Empty states por bloco**: as páginas tratam o vazio global, mas blocos individuais (ex.: "Top categorias" sem dados) mostram texto simples — coerente, mas um mini-`EmptyState` seria mais polido._
4. **`revenueBySource` donut mostra `%` no legend mas o valor € no nome** — funcional, mas dois números competem; podia mostrar só € e a fatia visual dar a proporção.

## What Works Well

- **Fidelidade ao design system**: zero hardcodes de cor fora da semântica (emerald=receita/recebido, red=despesa, amber=dívida, blue=lucro); `Card`/`Badge`/`Icon` reutilizados; `tabular-nums` em todos os números. Parece nativo do backoffice.
- **Decisão de não usar `recharts`**: estender `charts.jsx` (Heatmap, Waterfall) mantém o bundle leve e o estilo coeso — exatamente o espírito "calm".
- **Tríade de dinheiro** (`MoneyTriad`) é o coração do brief e está limpa, com hierarquia clara (Faturado neutro, Recebido verde, Em dívida âmbar) e crescimento inline.
- **Estados**: skeletons (`loading`) e `EmptyState` com ação estão presentes nas páginas e no kit; mutações do ginásio dão toasts (`sonner`).
- **Gated por permissão na URL**: tabs só aparecem com a permissão e o estado vai a `?vista=` (linkável) — o requisito multi-tenant cumprido no frontend, reforçado no backend (403 por rota).
- **Cobrança em massa** com barra fixa + checkboxes `aria-label` é um salto real de usabilidade face ao "marcar um a um".
- **Mobile-first**: grelhas `grid-cols-2 lg:grid-cols-4`, tabelas com `hidden sm/md:table-cell`, tabs com scroll — adapta, não só encolhe.
