# CLAUDE.md — Backoffice

Vite + React + TypeScript + TailwindCSS + React Query (gerado por Kubb).
Backoffice multi-tenant — um único deploy serve todos os clientes da plataforma.

---

## Comandos

```bash
pnpm dev        # gera código Kubb + inicia Vite (porta 5173)
pnpm build      # gera código Kubb + build de produção
pnpm kubb       # regenera hooks/types a partir do spec OpenAPI da API
pnpm lint       # tsc --noEmit (type check)
```

A API deve estar a correr em `VITE_API_BASE_URL` (default: `http://localhost:3001/api`).

---

## Estrutura

```
src/
  pages/          — páginas principais (uma por rota)
  components/     — componentes partilhados
  hooks/          — hooks manuais (não gerados pelo Kubb)
  gen/backoffice/ — código gerado pelo Kubb (não editar manualmente)
    hooks/        — 129 hooks React Query
    types/        — tipos TypeScript dos endpoints
  context/        — AuthContext (JWT + refresh automático)
  lib/            — utilitários (apiError, etc.)
  ui/             — componentes de UI base (Card, Button, Input, Modal, Icon, etc.)
  utils/          — langFlag.tsx e outros utilitários
```

---

## Páginas e Permissões

| Página | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| `Admin.tsx` | `/admin` | `VIEW_ADMIN` | Utilizadores, permissões, componentes RBAC, site tokens, línguas |
| `Agenda.tsx` | `/agenda` | `VIEW_SCHEDULE` | Calendário de agendamentos, serviços, horários, bloqueios |
| `Clientes.tsx` | `/clientes` | `VIEW_CUSTOMERS` | Lista de clientes, histórico de visitas |
| `Conteudos.tsx` | `/conteudos` | `VIEW_CMS` | CMS multi-língua: secções, entradas, textos, imagens |
| `Dashboard.tsx` | `/` | qualquer | Resumo de métricas do negócio |
| `Loja.tsx` | `/loja` | `VIEW_PRODUCTS` | Produtos, categorias, subcategorias, encomendas, cupões |

A navegação em `Shell.tsx` é gerada automaticamente a partir das permissões do utilizador autenticado.

---

## Componentes Partilhados

| Componente | Descrição |
|------------|-----------|
| `Shell.tsx` | Layout principal: sidebar, topbar, notification bell |
| `Login.tsx` | Formulário de login (standalone, sem Shell) |
| `NotificationBell.tsx` | Ícone com badge + dropdown de notificações em tempo real |
| `ApptModal.tsx` | Modal de criação/edição de agendamentos (usado em Agenda) |
| `FileUpload.tsx` | Upload de imagens para SeaweedFS via `/api/uploads` |
| `TranslationInputs.tsx` | Campos de tradução por língua com bandeiras reais |

---

## Hooks Manuais (src/hooks/)

| Hook | Descrição |
|------|-----------|
| `useSettingsLanguages.ts` | GET/PUT das línguas activas e língua padrão do tenant |
| `useCmsSearch.ts` | Pesquisa de entradas CMS por contexto e língua |
| `useNotifications.ts` | Lista e acções sobre notificações do tenant |
| `useSSE.ts` | Ligação SSE para notificações em tempo real |
| `usePushSubscription.ts` | Subscrição Web Push (subscribe/unsubscribe) |

---

## CMS (Conteudos.tsx)

O CMS tem três contextos: `website`, `product`, `service`.

- **Secções**: hierarquia de organização (parent/child)
- **Entradas**: `key` + `locale` + `value` + `type` (text | richtext | image)
- Traduções agrupadas por `key`: `Record<locale, value>`
- A língua padrão define a coluna principal das tabelas

---

## Línguas

Configuradas em Admin → tab "Línguas":
- **Línguas activas**: grid com bandeiras reais (`country-flag-icons`), toggle por clique
- **Língua padrão**: pills com bandeiras entre as línguas activas, clique para seleccionar
- PT é a língua padrão para novos utilizadores (definido na API)
- Mapeamento língua→país em `src/utils/langFlag.tsx`

`TranslationInputs` usa `useGetSettingsLanguages()` para renderizar um campo por língua activa.

---

## Notificações em Tempo Real

- **SSE** (`useSSE.ts`): ligação persistente a `/api/events/stream`, recebe eventos `notification`
- **Web Push** (`usePushSubscription.ts`): subscrição via VAPID, funciona com o browser fechado
- **NotificationBell**: badge com contagem não lida + dropdown com lista + acções (marcar lida, eliminar)
- Criadas automaticamente pela API em eventos chave (ex: novo agendamento público)

---

## Geração de Código (Kubb)

O spec OpenAPI `/api-docs/backoffice.json` é lido pelo Kubb e gera:
- `src/gen/backoffice/hooks/` — hooks React Query (useGet*, usePost*, etc.)
- `src/gen/backoffice/types/` — tipos TypeScript dos requests/responses

**Sempre que a API adiciona/modifica endpoints, correr `pnpm kubb`.**

Os ficheiros em `src/gen/` não devem ser editados manualmente.

---

## Autenticação

`AuthContext.tsx` gere:
- Login com `POST /users/login` → armazena `accessToken` em memória
- Refresh automático com `POST /users/refresh` (cookie httpOnly)
- CSRF token lido de `/csrf-token` e enviado em headers `x-csrf-token`
- `authHeader()` devolve `{ Authorization: "Bearer ..." }` para usar nos hooks
- `isAuthenticated` + `user` disponíveis em toda a app

---

## Segurança e Boas Práticas

- Nunca expor `userId` ou dados de outros tenants nas queries
- Sempre usar `authHeader()` nos hooks manuais
- O Kubb injeta automaticamente o header nos hooks gerados via o cliente axios configurado
- Uploads de imagem sempre via `FileUpload` → `/api/uploads` (nunca base64 em JSON)
