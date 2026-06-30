# Design Brief: Chat de Suporte (Admin ↔ Tenant)

> Canal de mensagens **1:1** entre o **Admin da plataforma** (o dono) e cada **tenant** (`User` do backoffice: barbeiro, ginásio, etc.), dentro do próprio backoffice. Nativo, assente na infra que já existe (SSE + Web Push + `notifyUser`). **Não** envolve os clientes finais nem os sites públicos.

---

## Problem

Hoje o dono da plataforma não tem forma de falar com os seus tenants dentro do produto. Quando um barbeiro tem uma dúvida, reporta um bug, ou o Admin quer avisar de uma manutenção/novidade, a conversa acontece fora (WhatsApp, email, telefone) — dispersa, sem histórico ligado ao tenant, e sem o conforto de saber se a mensagem foi lida. Do lado do tenant, não há um sítio óbvio para "falar com quem manda nisto"; quando algo falha, sente-se sozinho.

A fricção humana: **"preciso de falar com o meu cliente (tenant) — ou ele comigo — sem sair da ferramenta e sem perder o fio à meada."**

## Solution

Um chat de suporte embebido no backoffice, de **duas vias**:

- **Admin** abre a tab **"Mensagens"** (dentro de Admin, gated por `VIEW_ADMIN`) e vê um **inbox de todos os tenants** — lista à esquerda (não-lidos primeiro), conversa à direita. Pode iniciar conversa com qualquer tenant.
- **Tenant** (qualquer utilizador autenticado, sem permissão especial) tem um **ícone de chat no topbar**, ao lado da campainha de notificações, que abre a **sua** conversa (única) com o suporte. Pode escrever a qualquer momento.

As mensagens são **bolhas estilo messenger** (enviadas à direita/accent, recebidas à esquerda/zinc, agrupadas por dia), com **anexos** (texto + imagens/ficheiros via `/api/uploads`) e **"visto"**. Tudo na BD do próprio produto (RGPD-clean), entregue ao vivo por **SSE** e, com o browser fechado, por **Web Push**.

## Experience Principles

1. **Familiar antes de inventivo** — É um chat; deve parecer um chat que qualquer pessoa já usou (bolhas, composer em baixo, enviar com Enter). Zero curva de aprendizagem; reusa a linguagem visual do backoffice (zinc + accent, `Card`, `Avatar`, `Tabs`).
2. **O Admin vê tudo, o tenant vê só o seu** — A assimetria é o coração da feature e da sua segurança. A UI do Admin é um *cockpit de inbox* (escolher entre N tenants); a do tenant é *uma só conversa*. Nunca confundir os dois mundos.
3. **Vivo, mas calmo** — Tempo real onde acrescenta (chegou mensagem, "visto"), sem ruído: o chat tem o **seu próprio** contador de não-lidas (separado da campainha) e o Web Push/notificação é **coalescido** por conversa, não um *ping* por mensagem.

## Aesthetic Direction

- **Philosophy**: *Calm productivity / utilitarian messenger.* Conversa legível, hierarquia clara, nada decorativo. Encaixa no tom sóbrio do backoffice mas com o calor de um chat (bolhas arredondadas, avatares, agrupamento por dia).
- **Tone**: Funcional, próximo, confiável. Suporte que inspira "estou a ser ouvido".
- **Reference points**: Inbox de suporte do Intercom/Crisp (lado Admin), conversa do Telegram/iMessage (bolhas, "visto").
- **Anti-references**: Não é um cliente de email pesado; não é um fórum/ticketing com estados e prioridades; não é colorido/lúdico. Sem som, sem GIFs, sem reações por agora.

## Existing Patterns

Tudo o que segue **já existe** e deve ser reutilizado/estendido (não recriado). Referências de ficheiro confirmadas no código.

- **Topbar / montagem do launcher** — [src/components/Shell.tsx:134-139](src/components/Shell.tsx#L134-L139): contentor `ml-auto flex items-center gap-1.5 sm:gap-2` com `NotificationBell` na linha 135. O ícone de chat entra **a seguir** ao `NotificationBell`.
- **Badge de não-lidas** — [src/components/NotificationBell.tsx:204-211](src/components/NotificationBell.tsx#L204-L211): badge vermelho `absolute -top-0.5 -right-0.5 min-w-[16px] h-4 … rounded-full bg-red-500`. Reutilizar tal e qual para o badge do chat.
- **Painel + click-outside + Escape + scroll-lock mobile** — [src/components/NotificationBell.tsx:164-234](src/components/NotificationBell.tsx#L164-L234): `triggerRef`/`panelRef`, `mousedown` fora, `Escape`, backdrop mobile, posicionamento `fixed` (mobile) / `sm:absolute … sm:right-0 sm:mt-2` (desktop). É o **blueprint** do painel/drawer do tenant.
- **Taxonomia de notificações** — [src/components/NotificationBell.tsx:11-22](src/components/NotificationBell.tsx#L11-L22) (`NOTIF_META`): `booking · order · customer · gym · payment · stock · reminder · system`. **Adicionar `message`** (`label: "Mensagem"`, `dot: bg-cyan-500`, `chip: cyan`).
- **SSE** — [src/hooks/useSSE.ts:69-88](src/hooks/useSSE.ts#L69-L88) (`handleEvent`): dispatch por `event.type`. **Adicionar ramos `message` e `typing`**.
- **Tabs do Admin** — [src/pages/Admin.tsx:1557-1607](src/pages/Admin.tsx#L1557-L1607): array `TABS` + render condicional; o gate `VIEW_ADMIN` já está no Shell ([Shell.tsx:174](src/components/Shell.tsx#L174)). **Adicionar `{ id: "mensagens", label: "Mensagens", icon: "message" }`**.
- **Primitivas de UI** — [src/ui/ui.jsx](src/ui/ui.jsx): `Card`, `Button`, `IconButton`, `Badge`, `Input`, `Avatar`, `Modal`, `Tabs`, `EmptyState`, `SectionTitle`. **Não há `textarea`/auto-grow** — criar um `Composer` próprio com `<textarea>` controlado.
- **Ícones** — [src/ui/icons.jsx](src/ui/icons.jsx) (`ICON_PATHS` + `<Icon name…>`). **Faltam `message`, `send`, `paperclip`** — adicionar os paths (estilo Lucide, stroke).
- **Permissões** — [src/context/AuthContext.tsx:30](src/context/AuthContext.tsx#L30): `hasPermission(name)` / `permissions.some(p => p.name === 'VIEW_ADMIN')`. O lado tenant **não** precisa de permissão (é core, como as notificações).
- **Slide-over / drawer** — [src/components/Shell.tsx:209-222](src/components/Shell.tsx#L209-L222): drawer com backdrop `bg-zinc-900/40 backdrop-blur` + `animate-[slideIn_.2s_ease]`. Padrão para o drawer de conversa do tenant.
- **Upload diferido** — `/api/uploads` + padrão "segura local (`blob:`), envia ao Guardar" (Loja/CMS/MediaGallery). Reutilizar para anexos do chat.
- **Tipografia/cor/spacing**: Tailwind, paleta `zinc` + `accent` (teal), dark-mode em toda a parte, raios `rounded-xl`, bordas `border-zinc-200/80 dark:border-zinc-800`.

## Component Inventory

| Componente | Estado | Notas |
| --- | --- | --- |
| `ChatLauncher` (topbar do tenant) | **Novo** | `IconButton icon="message"` + badge de não-lidas (copia do `NotificationBell`). Abre o `ChatDrawer`. Montado no [Shell.tsx:135](src/components/Shell.tsx#L135), depois da campainha. **Só para não-admin** (o Admin usa a tab Mensagens). |
| `ChatDrawer` (tenant) | **Novo** | Slide-over à direita (`max-w-md`, altura total) com a conversa única tenant↔suporte. Header (avatar "Suporte"), `MessageThread`, `Composer`. Padrão de [Shell.tsx:209-222](src/components/Shell.tsx#L209-L222). |
| `MensagensTab` (admin) | **Novo** | Conteúdo da tab "Mensagens" do Admin. Master-detail: `ConversationList` (esq.) + `MessageThread`+`Composer` (dir.). Mobile = lista → conversa. |
| `ConversationList` (admin) | **Novo** | Lista de tenants com pesquisa, ordenada por `lastMessageAt`, **não-lidos primeiro**: `Avatar` + nome + preview da última msg + badge de não-lidas + timestamp. Botão "Nova conversa" (escolher tenant). |
| `MessageThread` | **Novo (partilhado)** | Render das bolhas + `DayDivider` + "visto". Auto-scroll ao fundo; paginação para cima (`?before=`). Partilhado por `ChatDrawer` e `MensagensTab`. |
| `MessageBubble` | **Novo** | Enviada (direita, `bg-accent text-white`) vs recebida (esquerda, `bg-zinc-100 dark:bg-zinc-800`). Agrupa consecutivas do mesmo autor. Mostra hora; "visto" sob a última enviada. Suporta anexos. |
| `Composer` | **Novo** | `<textarea>` auto-grow (1→6 linhas) + botão anexar (`paperclip`) + enviar (`send`). **Enter** envia, **Shift+Enter** quebra linha. Mostra *chips* de anexos pendentes (preview `blob:`). |
| `AttachmentChip` / preview | **Novo** | Miniatura de imagem / chip de ficheiro (nome+tamanho), com remover antes de enviar. Reusa upload diferido. |
| `DayDivider` | **Novo** | Separador "Hoje / Ontem / DD MMM" entre grupos de mensagens. |
| Hooks manuais (`useChat.ts`) | **Novo** | `useChatThread` (tenant) / `useAdminConversations` + `useAdminThread` (admin), `useSendMessage`, `useChatUnread`, `useMarkRead`. Falam com a nossa API + invalidam via SSE. |
| `NOTIF_META` | **Modificar** | +`message` (cyan) — [NotificationBell.tsx:11-22](src/components/NotificationBell.tsx#L11-L22). |
| `icons.jsx` | **Modificar** | +`message`, +`send`, +`paperclip`. |
| `useSSE.ts` | **Modificar** | +ramo `message` (invalida chat + bump unread). |
| `Shell.tsx` | **Modificar** | Montar `ChatLauncher` no topbar (não-admin). |
| `Admin.tsx` | **Modificar** | +tab "Mensagens" + render condicional. |

### Modelo de dados (API — referência para o brief, detalhe fica para o plano)

- `Conversation { id, tenantUserId (único), lastMessageAt, adminUnread, tenantUnread, adminLastReadAt, tenantLastReadAt }` — **uma thread por tenant**.
- `Message { id, conversationId, senderRole 'admin'|'tenant', senderUserId, body (nullable se só anexo), attachments (JSON: [{url,name,mime,size}]), createdAt, readAt }`.
- **"Visto"** derivado de `*LastReadAt` (mensagem vista se o `lastReadAt` do outro ≥ `createdAt`).
- **Endpoints** — Admin (`VIEW_ADMIN`): `GET /api/admin/chat/conversations`, `GET|POST /api/admin/chat/conversations/:tenantUserId/messages`, `POST …/read`. Tenant (qualquer autenticado): `GET|POST /api/chat/support/messages`, `POST /api/chat/support/read`.
- **Tempo real**: SSE `message` (sempre que chega mensagem). **Web Push** só quando o destinatário está offline. **Notificação na campainha**: coalescida (uma "Nova mensagem" por conversa, atualizada — não uma por mensagem).

## Key Interactions

- **Enviar mensagem**: escrever no `Composer` → **Enter** envia (Shift+Enter = nova linha). A bolha aparece otimista (estado "a enviar") e confirma ao responder a API; `lastMessageAt` sobe a conversa ao topo da lista do Admin.
- **Receber em tempo real**: SSE `message` → a thread aberta faz *append* + auto-scroll se já estava no fundo (se o utilizador rolou para cima, mostra pílula "↓ Nova mensagem"); o badge do launcher/lista incrementa.
- **"Visto"**: abrir/focar a conversa marca lida (`POST …/read`) → o outro lado vê a marca "Visto HH:MM" sob a última mensagem enviada (via SSE).
- **Anexos**: clicar `paperclip` → escolher ficheiro(s) → *chips* com preview `blob:` (ainda não enviados) → ao **Enviar**, faz upload (`/api/uploads`) e só então cria a mensagem com os URLs. Cancelar a mensagem descarta os ficheiros (sem órfãos).
- **Admin escolhe tenant**: clicar numa conversa da lista abre a thread à direita e marca lida; "Nova conversa" abre selector de tenant (Combobox) para iniciar do zero.
- **Não-lidas**: o badge do launcher (tenant) e os badges por-conversa (admin) refletem `*Unread`; zeram ao ler.

## Responsive Behavior

- **Tenant**: o `ChatDrawer` é slide-over à direita em desktop (`max-w-md`) e **full-screen** em mobile (mesma lógica `fixed inset-…` + scroll-lock do `NotificationBell`). O launcher fica sempre visível no topbar.
- **Admin (`MensagensTab`)**: **master-detail lado-a-lado** em ≥`lg` (lista ~`w-80` + thread flex-1); em `< lg` vira **navegação em duas vistas** (lista → conversa, com voltar). O `Composer` cola-se ao fundo; a thread faz scroll interno.
- **Composer**: `<textarea>` cresce até ~6 linhas e depois faz scroll interno; barra de anexos quebra para nova linha em ecrãs estreitos.

## Accessibility Requirements

- **Teclado**: launcher e itens da lista focáveis e ativáveis por Enter/Espaço; `Escape` fecha drawer/painel (padrão `NotificationBell`); foco move-se para o `Composer` ao abrir uma conversa e retorna ao launcher ao fechar.
- **ARIA**: drawer/painel com `role="dialog"` + `aria-label`; a thread como *log* (`role="log"` / `aria-live="polite"`) para anunciar mensagens recebidas sem roubar foco; badge de não-lidas com texto acessível ("3 mensagens não lidas").
- **Contraste**: bolhas enviadas `bg-accent text-white` e recebidas `bg-zinc-100/zinc-800` devem cumprir **≥ 4.5:1** em claro e escuro (validar o teal `accent` com branco). Hora/"visto" são secundários mas **≥ 3:1**.
- **Imagens anexadas**: `alt` com o nome do ficheiro; ficheiros não-imagem com nome+tipo legível.

## Out of Scope

- **Clientes finais** (end-customers dos tenants) e **sites públicos/PWA** — esta feature é **só** Admin↔tenant no backoffice. (O chat tenant↔cliente final é outro projeto.)
- **Conversas em grupo / multi-agente de suporte** — 1:1 apenas; um único interlocutor "Admin".
- **Broadcast / avisos em massa** a vários tenants de uma vez (decidido: só 1:1). Fica para uma feature futura por cima deste modelo.
- **Ticketing**: estados (aberto/fechado), prioridades, atribuição, SLAs, tags.
- **WhatsApp / email / SMS como canais** — só chat nativo nesta fase.
- **Indicador "a escrever…" (typing)** — cortado nesta versão (decisão 2026-06-30: o canal SSE extra não compensa). Mantém-se só "visto". Candidato a v2.
- **Reações, edição/apagar mensagem, encaminhar, pesquisa dentro da conversa, voz/vídeo/chamadas, mensagens agendadas** — não nesta versão (a pesquisa existe só na *lista* de conversas do Admin, não dentro do histórico).
- **Permissão dedicada `VIEW_MESSAGES`** — não se cria; tenant = core (todos), admin = `VIEW_ADMIN` (já existe).
- **Tradução i18n do conteúdo das mensagens** — é texto livre entre duas pessoas, não conteúdo de CMS.

---

## Nota de segurança (isolamento multi-tenant)

Exceção **deliberada** à regra de ouro ("nenhum endpoint devolve dados de outro `userId`"): o Admin **tem** de cruzar tenants. Mantém-se seguro por ser **assimétrico** — os endpoints `/api/admin/chat/*` exigem `VIEW_ADMIN`; os `/api/chat/support/*` resolvem a conversa **sempre pelo `userId` autenticado**, pelo que um tenant nunca acede à thread de outro. **A cobrir em testes** (`tests/e2e/isolamento`): tenant A não vê/escreve na conversa de tenant B; não-admin recebe 403 nas rotas `/api/admin/chat/*`.

## Próximos passos sugeridos

1. `/information-architecture` — afinar a navegação do inbox do Admin e do drawer do tenant (opcional; o layout já está bastante definido aqui).
2. `/brief-to-tasks` — partir este brief em tarefas independentes (vertical slices): API (modelo+migração+rotas+SSE) → hooks → UI tenant → UI admin → notificações/push → testes.
3. Implementar por fatias, correndo `pnpm kubb` se o spec da API mudar e `pnpm lint`/`pnpm test:unit`/`pnpm test:e2e` em cada fatia.
