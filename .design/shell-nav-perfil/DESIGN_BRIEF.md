# Brief — Shell: submenus na sidebar · Perfil do tenant · Tema persistente · Badge de mensagens

> **Data:** 2026-07-06 · **Decisões fechadas com o user** (AskUserQuestion): URLs de caminho real · perfil completo (conta+password+preferências+logo) · tema default = sistema · acesso ao perfil via avatar no topbar.

## O problema

1. **Tabs roubam espaço às páginas** e escondem a estrutura: 7 páginas têm tabs internas (Loja, Clientes, Financeiro, Website, Admin, Ginásio, Conteúdos, Agenda), cada uma com um padrão diferente de estado (só o Financeiro escreve `?vista=` na URL; as outras são `useState` local que no máximo lê `?tab=` ao montar).
2. **O tema não persiste**: `src/App.tsx:22` — `useState<"dark">("dark")` hardcoded; o toggle só muda estado em memória. Cada reload/browser volta a dark.
3. **Não há perfil**: o tenant não consegue editar os próprios dados. Na API só existe `PUT /users/` gated a `VIEW_ADMIN` (alvo arbitrário no body); o `AuthContext` nem guarda o email.
4. **O item Mensagens na sidebar não sinaliza não-lidas** (o badge existe só no `ChatLauncher`/`ChatFab` via `useChatUnread`).

## A experiência alvo

- **Sidebar com submenus**: cada página com tabs passa a item expansível no menu principal (acordeão; expande o ativo pela rota, colapsa os restantes). As tabs desaparecem das páginas → conteúdo ganha o espaço todo. Em modo sidebar colapsada (só ícones), o item pai mostra flyout com os subitens ao hover/click.
- **URLs de caminho real** por subpágina (`/loja/encomendas`, `/financeiro/despesas`, `/website/paginas`, …). Os deep-links antigos (`?tab=`/`?vista=`/`/despesas`) **redirecionam** — nada pode partir: `notificationTarget.ts`, `FirstValueChecklist`, emails/push antigos.
- **Tema**: default = `prefers-color-scheme` do sistema; escolha manual do user ganha sempre e fica **no servidor** (por `User`), com cache em `localStorage` + script inline no `index.html` para aplicar antes do primeiro paint (sem flash).
- **Perfil** (`/perfil`, core, via menu do avatar no topbar): dados da conta (nome do negócio, email), mudar password (atual→nova, invalida outros dispositivos via `tokenVersion`), preferências de UI (tema, língua padrão — reusa `settings/languages`), logo/avatar (upload diferido via `/api/uploads`). O avatar do topbar ganha dropdown: Perfil + Terminar sessão.
- **Badge de mensagens** no item Mensagens da sidebar (contagem/bolinha de `useChatUnread`), coerente com o ChatLauncher.

## Mapa de rotas novo (sidebar → URL)

| Item | Subitens (novas rotas) |
|---|---|
| Dashboard | — (`/dashboard`) |
| Estatísticas | — (`/estatisticas`) |
| Admin (`VIEW_ADMIN`) | `/admin/utilizadores` · `/admin/permissoes` · `/admin/componentes` · `/admin/tokens` · `/admin/faturacao` · `/admin/integracoes` · `/admin/atividade` · `/admin/sistema` |
| Clientes | `/clientes` (lista) · `/clientes/leads` |
| Mensagens | — (`/mensagens`, com badge) |
| Conteúdos | `/conteudos/website` · `/conteudos/produtos`* · `/conteudos/servicos`* · `/conteudos/ginasio`* · `/conteudos/linguas` · `/conteudos/emails` · `/conteudos/notificacoes` (*gated como hoje) |
| Website | `/website` (O meu site) · `/website/template` · `/website/paginas` · `/website/marca` · `/website/rodape-nav` · `/website/dominio` |
| Loja (`VIEW_PRODUCTS`) | `/loja/produtos` · `/loja/encomendas` · `/loja/categorias` |
| Agenda (`VIEW_SCHEDULE`) | `/agenda` (calendário) · `/agenda/marcacoes` · `/agenda/servicos` · `/agenda/config` |
| Ginásio (`VIEW_GYM`) | `/ginasio/exercicios` · `/ginasio/treinos` · `/ginasio/planos` · `/ginasio/clientes` |
| Financeiro | `/financeiro` (O Negócio) · `/financeiro/agenda`* · `/financeiro/loja`* · `/financeiro/ginasio`* · `/financeiro/despesas` (*gated como hoje) |
| Faturação | — (`/faturacao`) |
| (avatar topbar) | `/perfil` (fora da sidebar) |

**Redirects a manter para sempre:** `/despesas`→`/financeiro/despesas` · `?vista=X` no `/financeiro`→`/financeiro/X` · `?tab=X` em Loja/Clientes→path novo (preservando os restantes query params: `?cliente=`, `?lead=`, `?openProduct=`, `?marcacao=`, `?data=`, `?openService=` continuam a funcionar nos paths novos).

## Regras/constrangimentos

- Tabs internas de DETALHE não migram: as tabs da ficha do cliente (Agenda/Ginásio, `profileTab`) e sub-toggles (ex.: `visao/subscricoes` no Ginásio, preview de emails no Admin) ficam como estão — o menu só absorve as tabs de topo de página.
- Guard de rotas no `Shell.tsx` passa de igualdade exata para prefixo (`/loja/*` acessível se `/loja` acessível); tab gated por permissão → redirect para o 1.º subitem permitido.
- API nova (perfil/tema): endpoints **self** (`req.user`, nunca id no body), padrão `settings/languages` (`authenticateToken`+`billingGate` — escrita de perfil atrás do gate, leitura livre), zod, `@swagger`, testes de isolamento, `FUNCIONALIDADES.md`, `pnpm kubb:refresh` no BO. Migração para colunas novas do `User` (`uiTheme`, `logoUrl`).
- Mudança de email: exige password atual + email único; **v1 sem verificação por link** (aplicação direta) — verificação por email fica anotada como melhoria futura.
- Testes: as ~48 asserções do `Website.test.tsx` e os page objects e2e clicam nas tabs — migram no mesmo slice da página respetiva (Definition of Done inclui testes verdes).
- Aesthetic: nenhum tema novo — reusar primitivas (`NavItem`, `Icon`, `Badge`, `Card`, `Tabs` continua a existir para usos de detalhe).
