# Build Tasks: Chat de Suporte (Admin ↔ Tenant)

Generated from: .design/support-chat/DESIGN_BRIEF.md
Date: 2026-06-30

> Feature multi-repo: **API-FullStack** (Express + Sequelize) + **Backoffice** (React). Fatias verticais ordenadas por dependência → risco → prioridade visual. Typing indicator **fora de âmbito**. Sem permissão nova: admin = `VIEW_ADMIN` (já existe, com bypass do "Admin"), tenant = core (só `authenticateToken`).
>
> **Convenção de "done"** (memória do projeto): cada fatia entregue inclui **testes** + atualização do **CLAUDE.md** e, se mexer em rotas, do **API-FullStack/FUNCIONALIDADES.md**.

---

## Fase 1 — API: dados (API-FullStack)

- [ ] **Modelos + migração `Conversation` + `Message`** (risco primeiro): criar `models/conversation.ts` e `models/message.ts` (padrão `class extends Model` + `initX()`), registar em `models/index.ts`, associações em `models/associations.ts`, e uma migração `migrations/<ts>-create-conversations-and-messages.js` (`createTable` x2, atómica). `Conversation { conversationId(UUID PK), tenantUserId(UUID, único, FK Users), lastMessageAt, adminUnread(int), tenantUnread(int), adminLastReadAt, tenantLastReadAt }`. `Message { messageId(UUID PK), conversationId(FK), senderRole ENUM/STRING 'admin'|'tenant', senderUserId(UUID), body(TEXT null), attachments(JSON null), readAt(null), createdAt }`. _New. Estabelece o data layer; valida cedo a forma do schema (JSON de anexos + tracking de leitura)._

## Fase 2 — API: rotas + tempo real (API-FullStack)

- [ ] **Rotas + controllers (tenant + admin)**: `routes/.../chatRoutes.ts` montadas em `routes/index.ts`. **Tenant** (`/api/chat/support`, só `authenticateToken`, resolve conversa **sempre por `req.user`**): `GET messages?before=`, `POST messages`, `POST read`. **Admin** (`/api/admin/chat`, `authenticateToken` + `authorizePermissions(["VIEW_ADMIN"])`): `GET conversations` (lista com nome/avatar do tenant + preview + não-lidas + `lastMessageAt`, **não-lidos primeiro**), `GET conversations/:tenantUserId/messages?before=`, `POST conversations/:tenantUserId/messages`, `POST conversations/:tenantUserId/read`. Controllers com `try/catch` + `logServerError` + scoping por `userId`. _New. Depends on: modelos._
- [ ] **Tempo real + notificação coalescida**: ao criar mensagem, `broadcastToUser(recipientId, { type:"message", data:{conversationId,messageId,senderName,preview,createdAt} })` (SSE), **uma** notificação `message` por conversa (coalescida — atualizar/substituir a não-lida em vez de criar nova) e **Web Push só se offline** (`sendPushNotificationsToUser`). Adicionar `"message"` ao union `EventType` em `src/utils/notifyUser.ts`. **Decisão a fixar:** "quem é o admin a notificar" quando o tenant escreve → recomendado **todos os utilizadores com `VIEW_ADMIN`** (ou um `PLATFORM_OWNER_USER_ID` em config). _New. Depends on: rotas._
- [ ] **OpenAPI/JSDoc + schemas**: anotar `@openapi` nas rotas de chat + schemas `Conversation`/`Message` em `swagger/backoffice/swaggerBackoffice.ts`, para o spec `/api-docs/backoffice.json` ficar completo. Correr `pnpm build` (API) → confirmar que as rotas aparecem no spec. _Modify. Depends on: rotas._

## Fase 3 — Backoffice: camada de dados

- [ ] **`pnpm kubb` (tipos)**: regenerar `src/gen/backoffice/` a partir do spec atualizado para obter **tipos** dos endpoints de chat (os hooks gerados podem servir de base; a orquestração fica manual). _Depends on: JSDoc/spec._
- [ ] **Hooks manuais `src/hooks/useChat.ts`** (espelhar `useNotifications.ts`/`useScheduleCalendar.ts`, com `authHeader()`): `useChatThread` (tenant), `useAdminConversations` + `useAdminThread(tenantUserId)` (admin), `useSendMessage` (**otimista**: insere bolha "a enviar" e reconcilia), `useChatUnread`, `useMarkRead`. Usar tipos do Kubb onde existam. _New. Depends on: rotas + kubb._
- [ ] **SSE wiring** em `src/hooks/useSSE.ts`: adicionar ramo `if (event.type === "message")` → invalidar as queries de chat + atualizar contador de não-lidas (e a query de notificações já existente). _Modify ([useSSE.ts:69-88](src/hooks/useSSE.ts#L69-L88)). Depends on: hooks (query keys)._

## Fase 4 — Backoffice: UI partilhada (define a estética cedo)

- [ ] **Ícones + taxonomia**: adicionar paths `message`, `send`, `paperclip` a [src/ui/icons.jsx](src/ui/icons.jsx); adicionar `message` (cyan) a `NOTIF_META` ([NotificationBell.tsx:11-22](src/components/NotificationBell.tsx#L11-L22)). _Modify. Estabelece o vocabulário visual._
- [ ] **`MessageThread` + `MessageBubble` + `DayDivider`** (prioridade visual — valida o look "messenger"): render das bolhas (enviada direita `bg-accent text-white` / recebida esquerda `bg-zinc-100 dark:bg-zinc-800`, agrupa consecutivas), separadores "Hoje/Ontem/DD MMM", marca **"Visto HH:MM"** sob a última enviada, auto-scroll ao fundo + pílula "↓ Nova mensagem" se o user rolou, paginação para cima (`?before=`). `role="log"` + `aria-live="polite"`. _New (partilhado). Pode arrancar com dados mock para validar a estética antes dos hooks._
- [ ] **`Composer` (+ anexos)**: `<textarea>` auto-grow (1→6 linhas), **Enter** envia / **Shift+Enter** quebra, botão anexar (`paperclip`) com **upload diferido** (preview `blob:` → upload `/api/uploads` só ao Enviar) e *chips* de anexos removíveis; botão enviar (`send`). _New. Reuses: padrão de upload diferido (Loja/CMS/MediaGallery)._

## Fase 5 — Backoffice: superfície do tenant

- [ ] **`ChatLauncher` no topbar**: `IconButton icon="message"` + badge de não-lidas (copiar [NotificationBell.tsx:204-211](src/components/NotificationBell.tsx#L204-L211)), montado em [Shell.tsx:135](src/components/Shell.tsx#L135) **só para não-admin**. _New. Depends on: useChatUnread, ícones._
- [ ] **`ChatDrawer` (tenant)**: slide-over à direita (`max-w-md`, full-screen em mobile) com header "Suporte" + `MessageThread` + `Composer`; abrir/fechar e scroll-lock no padrão do `NotificationBell`; **marca lida ao abrir/focar**. _New. Depends on: MessageThread, Composer, hooks._

## Fase 6 — Backoffice: superfície do admin

- [ ] **Tab "Mensagens" no Admin (master-detail)**: adicionar `{ id:"mensagens", label:"Mensagens", icon:"message" }` ao `TABS` + render condicional ([Admin.tsx:1557-1607](src/pages/Admin.tsx#L1557-L1607)); `MensagensTab` = `ConversationList` (esq., `w-80`, pesquisa, **não-lidos primeiro**, `Avatar`+nome+preview+badge+timestamp, botão **"Nova conversa"** com selector de tenant via `Combobox`) + thread à direita (`MessageThread` + `Composer`). Responsivo: lado-a-lado em `≥lg`, navegação lista→conversa em `<lg`. _New + modify Admin.tsx. Depends on: MessageThread, Composer, hooks._

## Fase 7 — Testes

- [ ] **API — isolamento + fluxo** (`tests/backoffice/chat_isolation.test.ts`, Vitest+supertest): tenant A **não** lê/escreve a conversa de B; **não-admin → 403** em `/api/admin/chat/*`; fluxo enviar→receber→marcar lida (contadores + `*LastReadAt`); mensagem só com anexo (body null). _Depends on: API._
- [ ] **Backoffice — unit** (`tests/unit/`, Vitest+RTL, mockar `useChat`): `MessageThread` (bolhas/visto/dividers), `Composer` (Enter envia, Shift+Enter, chips de anexo), `ChatLauncher` (badge). Espelhar `ApptModal`/`NotificationsPanel`. _Depends on: componentes._
- [ ] **Backoffice — e2e** (`tests/e2e/`, Playwright): spec `chat` — tenant abre launcher, envia, (seed) admin vê em Mensagens, responde, tenant vê "Visto"; + caso **isolamento** (tenant A não vê thread de B; deep-link bloqueado). Semear conversas no `seedE2e.ts`. _Depends on: feature completa._

## Fase 8 — Docs & Review

- [ ] **Atualizar documentação** (definition of done): `Backoffice/CLAUDE.md` (nova página/tab + hooks + componentes), tabela de módulos da raiz `CLAUDE.md`, `API-FullStack/FUNCIONALIDADES.md` (novos endpoints), e a taxonomia de notificações (+`message`). _Modify._
- [ ] **Design review**: correr `/design-review` contra o brief (hierarquia, consistência, responsivo, acessibilidade, fidelidade estética).

---

## Estado da construção (2026-06-30)

**Construído + verificado (API `tsc` ✓ · Backoffice `tsc` ✓ · 9/9 unit a passar):**
- ✅ API: modelos `Conversation`/`Message` (`models/`) + migração `20260630120000-create-chat-tables.js` + associações.
- ✅ API: controllers (`controllers/backoffice/chat/chatController.ts`) + rotas (`routes/backoffice/chat/chatRoutes.ts`, montadas em `routes/index.ts`).
- ✅ API: tempo real + notificações (`src/utils/chatNotify.ts`: `getAdminUserIds`/`notifyNewMessage`/`clearMessageNotification`; `isUserOnline` em `sse.ts`; `message` na taxonomia de `notifyUser.ts`).
- ✅ API: schemas OpenAPI `Chat*` + JSDoc `@swagger`.
- ✅ Backoffice: `hooks/useChat.ts` (tipos locais), `useSSE.ts` (ramo `message`), ícones `message/send/paperclip`, `NOTIF_META.message`.
- ✅ Backoffice: `components/chat/*` (`MessageThread`, `Composer`, `ChatConversationView`, `ChatDrawer`, `ChatLauncher`, `MensagensTab`), montagem no `Shell.tsx` (não-admin) e tab no `Admin.tsx`.
- ✅ Testes: `tests/backoffice/chat_isolation.test.ts` (API) + `tests/unit/MessageThread.test.tsx` + `tests/unit/Composer.test.tsx`.
- ✅ Docs: `CLAUDE.md` (raiz + Backoffice), `API-FullStack/FUNCIONALIDADES.md`.

**Falta o utilizador correr (precisa de infra a postos):**
- ▶ **Migração da BD** — `pnpm dev`/`pnpm start` na API corre `sequelize-cli db:migrate` (cria `Conversations`/`Messages`). Em dev, o `sequelize.sync()` do arranque também as cria.
- ▶ **Testes da API** — `pnpm docker:test` (sobe a BD de teste `:3307`) + `pnpm test` → confirma `chat_isolation`.
- ▶ **(Opcional) `pnpm kubb`** — não é necessário (os hooks do chat são manuais), mas regenera tipos a partir dos novos schemas se quiseres.

**Por fazer (deixado de propósito):**
- ⬜ **e2e Playwright** (`tests/e2e/chat`) + seed de conversas em `seedE2e.ts` — não tocado para não arriscar partir a suite e2e sem a poder correr. Adicionar quando houver tempo para correr `pnpm test:e2e`.
- ⬜ Anexos **não-imagem** (ficheiros) — v1 só imagens (reusa `uploadImage`); ficheiros genéricos pedem endpoint de upload novo.
- ⬜ Typing indicator — cortado por decisão (v2).

---

### Notas de sequência

- **Caminho crítico:** Fase 1 → 2 → 3 desbloqueia todo o frontend. As Fases 4 (UI partilhada) podem começar em paralelo com dados **mock** para validar a estética cedo.
- **Risco concentrado** na Fase 1–2 (schema + coalescing de notificações + "quem é o admin"). Resolver isso antes de investir na UI.
- **Independentes entre si:** Fase 5 (tenant) e Fase 6 (admin) partilham `MessageThread`/`Composer` mas não dependem uma da outra — podem ser construídas em qualquer ordem após a Fase 4.
- Correr `pnpm lint` + `pnpm test:unit` a cada fatia de frontend; `pnpm test` (API) a cada fatia de backend.
