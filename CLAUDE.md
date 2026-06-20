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
| `Admin.tsx` | `/admin` | `VIEW_ADMIN` | Utilizadores, permissões, componentes RBAC, site tokens, línguas, **Atividade** (audit log) e **Sistema** (health + erros) |
| `Agenda.tsx` | `/agenda` | `VIEW_SCHEDULE` | Calendário de agendamentos, serviços, horários, bloqueios |
| `Clientes.tsx` | `/clientes` | `VIEW_CUSTOMERS` | Lista de clientes, histórico de visitas |
| `Conteudos.tsx` | `/conteudos` | `VIEW_CMS` | CMS multi-língua: secções, entradas, textos, imagens |
| `Dashboard.tsx` | `/` | qualquer | Resumo operacional (marcações de hoje, últimas marcações/encomendas) |
| `Despesas.tsx` | `/despesas` | `VIEW_EXPENSES` | Registo de custos: resumo mês/ano, gráfico por categoria, lista CRUD + gestão de categorias (criadas pelo user, com cor) |
| `Financeiro.tsx` | `/financeiro` | `VIEW_STATS` | Dashboard financeiro: receita, despesas, lucro, ticket médio, gráficos (`/api/dashboard`) |
| `Ginasio.tsx` | `/ginasio` | `VIEW_GYM` | Ginásio: catálogo de exercícios, grupos/subgrupos musculares, programas atribuídos por cliente, templates de treino e progresso (`/api/gym`) |
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
| `FileUpload.tsx` | Upload de imagem único para SeaweedFS via `/api/uploads` (atualmente sem uso) |
| `MediaGallery.tsx` | Galeria de imagens/vídeos (Ginásio). **Upload diferido**: segura os ficheiros localmente (preview `blob:`) e só os envia ao Guardar, via `uploadPendingMedia()` |
| `Combobox.tsx` | Dropdown custom com pesquisa. Menu renderizado em **portal** (`document.body`, posição fixa) para não ser cortado por overflow de modais. `ref` aponta para o botão; tem `label`/`disabled` |
| `DateRangePicker.tsx` | Selector de intervalo de datas (`react-day-picker`, modo range, locale PT). Usado ao atribuir um programa |
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
| `useDashboard.ts` | GET `/api/dashboard?period=` tipado (schedule + ecommerce + expenses) para a página Financeiro |
| `useAuditLogs.ts` | `useAuditLogs`/`useErrorLogs`/`useHealth` — tabs Atividade e Sistema do Admin (só `VIEW_ADMIN`) |

> Despesas usa hooks gerados pelo Kubb (`useGetExpenses`, `useGetExpensesSummary`, `usePostExpenses`, …) para as despesas, e o hook manual `useExpenseCategories.ts` (list/create/update/delete) para as **categorias criadas pelo tenant**. As categorias têm cor própria; `src/utils/expenseCategories.ts` só guarda a paleta de cores sugeridas.

---

## Ginásio (Ginasio.tsx)

Página com 5 tabs: **Programas** (por cliente), **Catálogo**, **Grupos de exercícios** (bundles reutilizáveis = `WorkoutTemplate`), **Planos** (templates por dias) e **Progresso** (por cliente). Usa hooks gerados pelo Kubb (`useGetGymExercises`, `useGetGymMuscleGroups`, `useGetGymPrograms`, `useGetGymWorkoutTemplates`, `useGetGymPlanos`, …).

- **Hierarquia**: Exercício (+presets) → **Grupo de exercícios** (bundle, sem dias) → **Plano** (dias; cada dia tem exercícios soltos e/ou um grupo de exercícios) → **Programa** (plano atribuído a um cliente, com `startDate`/`endDate`).
- **Atribuir** (`PlanosTab` → "Atribuir", ou `ProgramasTab`): copia o plano/grupo para um **Programa** do cliente (*snapshot*). Editar o programa do cliente **não** afeta o template e vice-versa. As datas escolhem-se com o `DateRangePicker` (react-day-picker).

- **Grupos e subgrupos musculares** (`/api/gym/muscle-groups`): hierarquia de 1 nível via `parentId` (ex: *Peito → Peito superior*). Geridos no modal "Grupos" do Catálogo. A cor de um novo grupo/subgrupo vem **aleatória** de `GROUP_COLORS` (o user pode mudar). Apagar um grupo apaga os seus subgrupos (os exercícios guardam o nome em snapshot, por isso não corrompem).
- **Catálogo de exercícios** (`/api/gym/exercises`): cada exercício pertence a um grupo de topo e, opcionalmente, a um `subGroup`. Em vez de um único conjunto de defaults, tem **presets nomeados** (`presets: [{ id, name, sets, reps, weight, rest }]`, ex: "Iniciante", "Avançado"). Os campos `default*` legados são derivados do 1.º preset (compat com a PWA/público).
- **Montar treino** (`WorkoutModal`/`WorkoutTemplateModal`): ao adicionar um exercício do catálogo, se este tiver presets aparece um selector que pré-preenche séries/reps/peso/descanso — **continuam editáveis** por cliente. Os exercícios prescritos guardam snapshot de `group`/`subGroup`.

> Todos os dropdowns da página usam o componente custom `Combobox` (com pesquisa), não os `<select>`/`Select` nativos.

---

## CMS (Conteudos.tsx)

O CMS tem três contextos: `website`, `product`, `service`.

- **Secções**: hierarquia de organização (parent/child)
- **Entradas**: `key` + `locale` + `value` + `type` (text | richtext | image)
- Traduções agrupadas por `key`: `Record<locale, value>`
- A língua padrão define a coluna principal das tabelas

### Importar conteúdo via CSV

Para popular o CMS de um novo site de cliente, criar um `content-import.csv` e importar via `POST /api/cms/setup`.

**Formato — 6 colunas obrigatórias:**

```
key,locale,value,type,section,parent
```

| Coluna | Descrição |
|--------|-----------|
| `key` | Identificador único em dot-notation (`hero.title`, `project.slug.stat.1.value`) |
| `locale` | Código de língua: `pt`, `en`, `fr` |
| `value` | O conteúdo. **Nunca deixar vazio** — apagar a linha inteira se não há valor |
| `type` | Ver tabela abaixo |
| `section` | Nome da secção a que a entrada pertence |
| `parent` | Nome da secção pai; deixar vazio para secções raiz |

**Tipos de conteúdo:**

| Tipo | Quando usar |
|------|-------------|
| `text` | Títulos, labels, descrições, qualquer string |
| `richtext` | HTML inline simples (`<em>`, `<strong>`, `<br>`) |
| `number` | Valores numéricos (anos, contagens, áreas) |
| `data` | Slugs, referências internas, flags — não é texto traduzível |
| `url` | Links externos |
| `email` | Endereços de email |
| `phone` | Números de telefone |
| `file` | URL de ficheiro para download (PDF, etc.) |
| `image` | URL de imagem (OG images, fotos, etc.) |

**Regras:**

1. **Sem valores vazios** — a linha é ignorada se `value` estiver em branco. Apagar a linha em vez de deixar vazio.
2. **Slugs e referências** usam tipo `data` e só precisam de locale `pt`.
3. **URLs, ficheiros, OG images** — só precisam de locale `pt` (são neutros em termos de língua).
4. **Textos traduzíveis** devem ter uma linha por cada locale activo.
5. **Hierarquia de secções**: `section` + `parent` criam a árvore automaticamente — não é necessária uma ordem específica no ficheiro.

**Exemplo mínimo:**

```csv
key,locale,value,type,section,parent
hero.title,pt,Título em Português,text,Hero,Homepage
hero.title,en,Title in English,text,Hero,Homepage
hero.cta,pt,Saber mais,text,Hero,Homepage
contact.email,pt,geral@cliente.pt,email,Contactos,Homepage
seo.home.title,pt,Cliente — Slogan,text,SEO · Homepage,SEO
seo.home.og_image,pt,https://cliente.pt/assets/og.jpg,image,SEO · Homepage,SEO
```

O ficheiro `winterplateau/content-import.csv` é o exemplo de referência com um site completo (nav, hero, produtos, projetos com SEO, 3 línguas).

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
- Uploads de imagem/vídeo via `/api/uploads` (nunca base64 em JSON)
- **Upload diferido**: ficheiros escolhidos são segurados localmente (preview `blob:`) e só enviados quando o user clica em **Guardar** — nunca no momento de escolher. Evita ficheiros órfãos no storage se o formulário for cancelado. Aplica-se a: Ginásio (`MediaGallery` + `uploadPendingMedia`), Loja (foto do produto) e Conteúdos/CMS (imagens das entradas)
