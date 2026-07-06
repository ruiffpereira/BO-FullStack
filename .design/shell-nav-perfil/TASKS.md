# Build Tasks: Shell — submenus · perfil · tema · badge

Generated from: .design/shell-nav-perfil/DESIGN_BRIEF.md
Date: 2026-07-06 · Execução: agentes (Sonnet) + review adversarial, fatia a fatia, commit por fatia.

## Fase 0 — Quick wins (independentes, valor imediato)

- [x] **T0.1 Tema: persistência local + default do sistema**: `App.tsx` — init lazy do tema: `localStorage("bo.theme")` > `prefers-color-scheme` > dark; `toggleTheme` grava no localStorage; script inline no `index.html` aplica a classe `dark` antes do 1.º paint (sem flash) e alinha o `<meta theme-color>`. _Modifica: `src/App.tsx:22-43`, `index.html`. Testes: unit do init (3 caminhos)._ (O lado servidor chega no T3.4 — este slice já resolve "esquece o tema no reload".)
- [x] **T0.2 Badge de mensagens na sidebar**: `NavItem` ganha prop `badge?: number`; o Shell liga `useChatUnread()` ao item `/mensagens` (bolinha com contagem, cap "9+", `aria-label`). Coerente com o `ChatLauncher`; visível também com sidebar colapsada (dot no ícone). _Modifica: `src/components/Shell.tsx:47-62`. Reusa: `useChatUnread` (`src/hooks/useChat.ts:207`)._

## Fase 1 — Fundação da navegação (bloqueia a Fase 2)

- [ ] **T1.1 Sidebar com submenus + rotas aninhadas (infra)**: `SUBMENU` map (path pai → subitens `{id,label,path,perm?}`) como fonte única; `NavItem` expansível (acordeão: expande o pai da rota ativa, seta rotação, `aria-expanded`); ativo por prefixo; flyout no modo colapsado (portal, hover/click); drawer mobile herda os submenus. Guard do `Shell.tsx:203-207` passa a prefixo + redirect de tab sem permissão para o 1.º subitem permitido. Rotas aninhadas declaradas no `App.tsx` (uma rota por subpágina; pai redireciona para o 1.º subitem quando aplicável). _Modifica: `Shell.tsx`, `App.tsx:76-93`. Nada muda ainda nas páginas — o Financeiro serve de piloto no T1.2._
- [ ] **T1.2 Piloto: Financeiro em paths reais**: `/financeiro`(negócio)·`/financeiro/agenda|loja|ginasio|despesas`; remove as `Tabs` da página; redirects `?vista=X`→path e `/despesas`→`/financeiro/despesas`. Atualiza `notificationTarget.ts` (`payment/reminder`→`/financeiro/ginasio`) e `FirstValueChecklist` (2 hrefs). _Modifica: `FinanceiroPage.tsx`, `App.tsx:82`, `notificationTarget.ts`, `FirstValueChecklist.tsx:123,145`. Testes: `notificationTarget.test.ts` + e2e financeiro/despesas._ **Gate: design-review do padrão visual do submenu antes de replicar.**

## Fase 2 — Migração página a página (independentes entre si; todas dependem do T1.1)

Cada slice: rotas novas + remoção das `Tabs` de topo + redirect `?tab=` + deep-links preservados + unit/e2e/page objects da página migrados.

- [ ] **T2.1 Loja**: `/loja/produtos|encomendas|categorias`; `?tab=`→redirect; `?openProduct=` continua; `notificationTarget` (`order`, `stock`) + `FirstValueChecklist` (2 hrefs). _Modifica: `Loja.tsx:411-420,759-761`._
- [ ] **T2.2 Clientes**: `/clientes`(lista)·`/clientes/leads`; `?tab=leads&lead=`→`/clientes/leads?lead=`; `?cliente=` mantém-se; tabs da ficha (agenda/ginásio) NÃO migram. _Modifica: `Clientes.tsx:79-85,265-268`; `notificationTarget` (`customer`)._
- [ ] **T2.3 Website**: `/website`·`/website/template|paginas|marca|rodape-nav|dominio`. _Modifica: `Website.tsx:78-84,1713`; migrar as ~48 asserções de `tests/unit/Website.test.tsx` que navegam por tabs._
- [ ] **T2.4 Admin**: `/admin/utilizadores|permissoes|componentes|tokens|faturacao|integracoes|atividade|sistema` (`/admin`→utilizadores). _Modifica: `Admin.tsx:1557-1601`; e2e admin/admin-tokens._
- [ ] **T2.5 Ginásio**: `/ginasio/exercicios|treinos|planos|clientes` (`/ginasio`→exercicios); sub-toggle interno fica. _Modifica: `Ginasio.tsx:2879-2895`; e2e ginasio/ginasio-detalhe._
- [ ] **T2.6 Conteúdos**: `/conteudos/website|produtos|servicos|ginasio|linguas|emails|notificacoes` com gating por permissão por subitem (o submenu da sidebar filtra como `visibleTabs`). _Modifica: `Conteudos.tsx:116-133,784-787`; e2e conteudos/conteudos-multilingua._
- [ ] **T2.7 Agenda**: `/agenda`(calendário)·`/agenda/marcacoes|servicos|config`; `?marcacao=`/`?data=`/`?openService=` continuam (openService passa a apontar a `/agenda/servicos`). _Modifica: `Agenda.tsx:2890-2901`; `notificationTarget` (`booking/reminder`); e2e agenda/agenda-pagamentos._
- [ ] **T2.8 Varredura de deep-links órfãos**: grep final a `?tab=|?vista=|/despesas` em `src/**` + e2e + emails/push (API `notifyUser` payloads) — tudo ou migrado ou coberto por redirect. _Novo teste unit: mapa de redirects._

## Fase 3 — Perfil do tenant (API primeiro; independente das Fases 1-2)

- [ ] **T3.1 API: `GET/PUT /users/me` (self)**: novo controller self (padrão `settings/languages` — `req.user`, nunca id no body): GET devolve `{name,email,phone,logoUrl,uiTheme,defaultLanguage}`; PUT atualiza `name,email,phone,logoUrl` (email: exige `currentPassword` + unique — 409; v1 sem verificação por link). Migração `Users.uiTheme` (enum `light|dark|system`, default `system`) + `logoUrl`. Zod + `@swagger` + testes (isolamento self, email duplicado, mass-assignment de `permissionId` rejeitado) + `FUNCIONALIDADES.md`. _Gate: agente seguranca-api; escrita atrás do `billingGate`._
- [ ] **T3.2 API: `PUT /users/me/password`**: atual→nova (política mínima igual ao setup), bump `tokenVersion` (invalida os outros dispositivos, mantém a sessão atual emitindo novo par de tokens). Testes: password errada 401, sessões antigas invalidadas. _Gate: seguranca-api + Workflow adversarial (código de auth)._
- [ ] **T3.3 BO: página `/perfil` + menu do avatar**: dropdown no `Avatar` do topbar (`Shell.tsx:145`) → Perfil · Terminar sessão; página com Cards: Conta (nome/email/phone, GuardButton), Password, Preferências (tema light/dark/system com `Tabs` sm + língua padrão reusando `useSettingsLanguages`), Logo (FileUpload `deferred`). `pnpm kubb:refresh` primeiro (hooks `useGetUsersMe`/`usePutUsersMe`/…). `AuthContext` passa a guardar `email`. Rota core `/perfil` fora da sidebar. _Novo: `src/pages/Perfil.tsx`; unit tests da página; e2e perfil._
- [ ] **T3.4 Tema server-side**: `uiTheme` do `GET /users/me` alimenta o init do tema (ordem: servidor > localStorage > sistema); mudar tema (topbar ou perfil) faz PUT + atualiza localStorage; multi-browser resolvido. _Depende: T0.1 + T3.1 + T3.3._

## Fase 4 — Polish & fecho

- [ ] **T4.1 Responsivo/a11y do menu novo**: navegação por teclado no acordeão/flyout (setas, Enter, Esc), `aria-current` nos subitens, foco visível, drawer mobile com submenus utilizável a uma mão. Breakpoints: `<lg` drawer, `lg+` sidebar/colapsada.
- [ ] **T4.2 Docs**: CLAUDE.md do BO (tabela de páginas → nova coluna de rotas/submenus, secção do perfil e tema), CLAUDE.md da API (endpoints self), memória.
- [ ] **Design review**: /design-review contra o brief (sidebar expandida/colapsada/mobile, perfil, tema nos 2 modos).

## Ordem de execução recomendada

`T0.1 + T0.2` (paralelo, commits imediatos) → `T1.1` → `T1.2` (gate visual) → `T2.1…T2.7` (paralelo por agentes, worktrees) → `T2.8` → `T3.1 → T3.2 → (kubb) → T3.3 → T3.4` (pode correr em paralelo com a Fase 2 até ao T3.3) → `T4.*`.
