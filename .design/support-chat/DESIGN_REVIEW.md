# Design Review: Chat de Suporte — Responsividade / PWA

Reviewed against: DESIGN_BRIEF.md
Philosophy: Calm productivity / utilitarian messenger
Date: 2026-06-30
Foco: responsividade (mobile/tablet/desktop) + comportamento PWA

## Screenshots Captured

> ⚠️ **Não foi possível capturar screenshots automaticamente.** Não há browser-MCP
> disponível nesta sessão; a app de **dev** está atrás de login (sem credenciais) e a
> infra **e2e** (contas conhecidas) tem a BD `:3307` em baixo. A revisão foi feita
> **a partir do código** (componentes escritos nesta feature) + as 2 screenshots
> **desktop** que o utilizador forneceu (vista de tenant e inbox de admin, ambas a
> ~1280px). Para uma passagem visual mobile/tablet, ver "Como capturar" no fim.

| Screenshot | Breakpoint | Descrição |
| --- | --- | --- |
| (fornecida pelo user) | Desktop ~1280 | /mensagens — vista tenant ("Fala com o suporte") |
| (fornecida pelo user) | Desktop ~1280 | /mensagens — inbox admin ("Conversas com os teus clientes") |
| _mobile 375 / tablet 768_ | — | **em falta** (capturar quando houver browser/credenciais) |

## Summary

A arquitetura responsiva está **fundamentalmente correta** — o master-detail do admin
**reorganiza** (lista→conversa) abaixo de `lg` em vez de só encolher, o popup é
full-width em mobile, e o widget/drawer usam o padrão de overlay da app. O maior
problema era de **altura em mobile**: os contentores usavam `100vh`, que **não encolhe**
quando o teclado on-screen aparece → o composer era empurrado para fora do ecrã. Corrigido
para `100dvh`. Aplicadas também correções de alvos de toque e safe-area. Tudo **já corrigido
neste commit**.

## Must Fix

_(nenhum — sem layout partido nem falha funcional)_

## Should Fix → ✅ CORRIGIDO

1. **Altura `100vh` quebra com o teclado on-screen (mobile/PWA).** `Mensagens.tsx`
   (`TenantSupport`), `MensagensTab.tsx` e `ChatPopup.tsx` usavam `h-[calc(100vh-…)]` /
   `h-[min(560px,calc(100vh-…))]`. Em mobile o `100vh` **inclui** a barra do browser e
   **não encolhe** com o teclado → o `Composer` ficava abaixo da dobra ao escrever.
   _Fix aplicado:_ `100vh` → **`100dvh`** (dynamic viewport height) nos 3 contentores — o
   layout encolhe com o teclado e mantém o composer visível.
2. **Alvos de toque do composer < 40px.** Os botões anexar/enviar eram `w-9 h-9` (36px),
   abaixo do mínimo confortável para toque. _Fix aplicado:_ → `w-10 h-10` (40px).
3. **Bolinha (FAB) sem safe-area no iPhone.** `bottom-5` podia sobrepor-se ao home
   indicator em PWA iOS. _Fix aplicado:_ `bottom-[max(1.25rem,env(safe-area-inset-bottom))]`.

## Could Improve

1. **Popup widget vs safe-area:** o `ChatPopup` está em `bottom-[5.5rem]` (alto o
   suficiente), mas em iPhones muito pequenos com teclado aberto pode ficar apertado.
   Suficiente com o `100dvh`; reavaliar se houver queixas.
2. **Composer — `16px` no input mobile:** o `<textarea>` é `text-sm` (14px). No iOS,
   inputs < 16px provocam **auto-zoom** ao focar. Considerar `text-[16px]` no textarea em
   mobile (`text-base sm:text-sm`) para evitar o zoom. _(não alterado — é uma escolha; digo
   ao user.)_
3. **Toques nos itens da lista de conversas** já são confortáveis (linha inteira clicável,
   `py-2.5` + avatar 40px). OK.

## What Works Well

- **Reorganização real, não só encolher:** o inbox do admin (`MensagensTab`) é
  `hidden lg:flex` na lista quando há conversa selecionada → em mobile vira **uma coluna**
  (lista → conversa com botão Voltar). Padrão correto.
- **Popup full-width em mobile:** `w-[calc(100vw-2rem)] sm:w-[380px]` — ocupa o ecrã com
  margens em telemóvel e fica compacto em desktop.
- **Tabs do Admin (7) com scroll horizontal** (`overflow-x-auto` no `Tabs`) — não rebenta
  em ecrãs estreitos.
- **Bolhas com `max-w-[80%]`**, `break-words` e `whitespace-pre-wrap` — sem overflow
  horizontal nem linhas demasiado largas.
- **Dark mode** consistente (todas as cores via `dark:` + token `accent`), e foco visível
  (`focus:ring-accent/30`) no composer.
- **Acessibilidade:** `role="dialog"`/`role="log"` + `aria-live="polite"`, `aria-label`
  em todos os ícones-botão, Esc fecha overlays.

## Como capturar os screenshots mobile (quando quiseres a passagem visual)

Com a app de dev a correr e sessão iniciada, ou com a infra e2e de pé:
1. DevTools → device toolbar (Ctrl+Shift+M) → 375×812 (iPhone) e 768×1024 (iPad), em
   `/mensagens` (admin e tenant) + abrir a bolinha + focar o composer (teclado).
2. Ou um script Playwright que faz `loginAs(admin@e2e/limited@e2e)` + `page.setViewportSize`
   + `screenshot`, guardando em `.design/support-chat/screenshots/`. (Precisa da infra e2e:
   `pnpm test:e2e` levanta tudo; a BD `:3307` tem de estar de pé.)
