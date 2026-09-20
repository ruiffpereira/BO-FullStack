# Soft delete de tenants — levantamento e decisões

**Criado:** 2026-09-20 · **Estado:** levantado, decisões propostas, **bloqueado numa verificação**
**Pedido do dono:** poder apagar um utilizador no Backoffice sem apagar nada na BD — deixar as
linhas lá, marcadas como apagadas, para um dia recuperar.

---

## O que se descobriu — e duas premissas minhas que estavam erradas

**Errado #1: "40 modelos com `userId`".** São **36** (34 com a coluna literal, mais
`Conversation.tenantUserId` e `Message.senderUserId`). O meu `grep` contou comentários.

**Errado #2: "apagar um tenant deixa ~34 tabelas órfãs".** Não deixa. A maioria das tabelas tem
**`onDelete: CASCADE` real na base de dados**, declarado nas próprias migrações. Hoje, quando um
`User.destroy({force:true})` chega a executar, **a base de dados apaga tudo em cascata** — agenda,
ginásio, CMS, site, faturação, chat, notificações. Não fica lixo: fica um apagar em massa,
irreversível, feito pela BD por fora do código que se lê no `deleteUser`.

Isto muda o enquadramento. O problema não é limpeza — é que **hoje o botão de apagar é uma bomba**.

### Um terceiro achado, mais incómodo: o apagar pode nem sequer funcionar

`deleteUser` (`controllers/backoffice/admin/userController.ts:551`) apaga à mão, por esta ordem:
`Cart` → `Customer` → `Category` → `Product` → `UserPermission` → `User`.

São exactamente as tabelas **sem `onDelete` explícito** nas associações. O facto de serem apagadas
à mão sugere fortemente que têm FK bloqueante (`RESTRICT`/`NO ACTION`) na BD real — senão o código
seria desnecessário.

Mas `Order`, `Appointment`, `Service`, `WorkingHours`, `BlockedSlot`, `Address` e `BankCard`
**não são tocados**. Se alguma delas tiver FK bloqueante, o `User.destroy()` final rebenta com erro
de chave estrangeira e o `catch` genérico devolve **500**.

> **Ou seja: é plausível que hoje seja impossível apagar um tenant que tenha marcações ou
> encomendas — e que o erro apareça como um 500 sem explicação.**

### Porque é que isto não se confirma pelo código

Estas tabelas **não têm migração de criação** no repositório. A mais antiga rastreada é
`20260317225707` (só `RefreshTokens`); o esquema base nasceu antes de o repo rastrear migrações, e
essa DDL não existe em lado nenhum legível. Em produção, o `sequelize.sync()` do arranque só cria
tabelas em falta — **nunca altera FKs de tabelas existentes**. Os testes não servem de prova: usam
`sync({force:true})`, que gera um esquema a partir das associações, não o de produção.

**Tem de ser verificado contra a base de dados de produção.** Ver "O que está a bloquear".

---

## Inventário — 36 modelos ligados a um tenant

Nenhum é `paranoid`, **excepto `Category`** (`models/category.ts:52`).

| Módulo | Modelos |
|---|---|
| Agenda (4) | `appointment` · `service` · `workingHours` · `blockedSlot` |
| Ginásio (11) | `exerciseCatalog` · `muscleGroup` · `workoutTemplate` · `plano` · `program` · `workout` · `workoutLog` · `gymSubscription` · `gymMembership` · `gymPayment` · `gymCalendarPref` |
| Loja (4) | `category` (**paranoid**) · `product` · `order` · `coupon` |
| CMS (2) | `contentEntry` · `contentSection` |
| Faturação (3) | `expense` · `expenseCategory` · `platformSubscription` |
| Chat (2) | `conversation` (`tenantUserId`) · `message` (`senderUserId`) |
| Site (2) | `site` · `siteToken` |
| Notificações (2) | `notification` · `pushSubscription` |
| Outros (6) | `customer` · `lead` · `googleIntegration` · `auditLog` (nullable) · `refreshToken` (nullable) · `userPermission` |

`RefreshTokens.userId` é o **único órfão silencioso confirmado** — a coluna não tem FK nenhuma.

> **Não é um buraco de segurança — verificado.** `refreshUserToken`
> (`userController.ts:365`) faz `User.findByPk` e devolve 401 se o utilizador não existir. Um token
> órfão **não consegue** emitir uma sessão para um tenant apagado. O que fica é lixo que se acumula
> para sempre, e uma regra que o código assume mas a base de dados não impõe.
>
> ⚠ E com soft delete a FK resolve menos do que parece: a linha do `User` **nunca desaparece**, logo
> um `ON DELETE CASCADE` nunca dispara. A correcção verdadeira é chamar `revokeAllRefreshTokens`
> (já existe, `src/utils/tokenUtils.ts:82`) ao apagar. A FK fica como rede, não como solução.

---

## As decisões

### 1. O que fica `paranoid`? · **Recomendo: só o `User`**

Pôr `paranoid` nos 36 obrigaria a 36 migrações e mudaria o comportamento de todas as queries do
produto. Não é preciso: os dados dos filhos já estão scoped por `userId`, e **nenhum endpoint
devolve dados de um `userId` diferente do autenticado** — se o tenant não autentica, os dados dele
são inalcançáveis por essa via.

O que sobra são as superfícies que **cruzam tenants**, e essas são uma lista curta e enumerável
(decisão 4). Muito mais barato, e muito menos superfície para partir.

⚠ **Consequência directa:** com `User` paranoid, a BD deixa de cascatar — as linhas dos filhos
**ficam**. É o que se quer (recuperar um dia), mas é também o que obriga à decisão 5.

### 2. O email fica preso · **Recomendo: reescrever ao apagar**

`User.email` é único (`models/user.ts:65` + índice `users_email_unique`). Uma linha apagada
continua a ocupá-lo.

O truque habitual — índice composto `(email, deletedAt)` — **não funciona em MySQL**: NULLs são
tratados como distintos num índice único, e todas as linhas vivas têm `deletedAt = NULL`, logo o
índice deixaria de garantir unicidade entre vivos.

Recomendação: ao apagar, reescrever o email para uma forma reservada (ex.: `deleted_<userId>_<email>`)
e guardar o original noutra coluna, para a recuperação o poder repor. O índice fica intacto e o
email liberta-se.

### 3. O subdomínio fica preso · **Recomendo: libertar e despublicar**

`Site.subdomain` e `Site.customDomain` são únicos, e `Site.userId` também (1 site por tenant).
Um tenant apagado não pode continuar a reservar `ginasio.rufvision.com`.

Ao apagar: libertar o subdomínio e pôr `published: false`. Mesma lógica do email — guardar o valor
antigo para a recuperação.

Também únicos e 1:1, com o mesmo problema: `PlatformSubscription.userId`,
`GoogleIntegration.userId`, `Conversation.tenantUserId`.

### 4. Quem cruza tenants · **Recomendo: `paranoid` resolve quase tudo, menos um**

Com `User` paranoid, todo o `User.findAll`/`findByPk` passa a excluir apagados **sozinho**. Isso
cobre, sem código novo:

- `authenticateToken` (`src/middleware/auth.ts:62`) — corre em **todos** os pedidos autenticados do
  backoffice. É o ponto de maior alavancagem: um tenant apagado deixa de autenticar de imediato.
- `loginUser`, `refreshUserToken`, `setupPassword`, `sendResetEmail`, `signup`
- `GET /api/users` (lista de tenants do Admin) · painel de Faturação · inbox do chat · audit log

**A excepção, e é real:** `getAdminUserIds` (`src/utils/chatNotify.ts:41`) consulta
`UserPermission`, **não** `User`. Uma `UserPermission` órfã continuaria a receber notificações de
chat. Precisa de filtro explícito.

### 5. Os crons · **A maior mudança de comportamento, e a mais fácil de esquecer**

`src/jobs/reminders.ts` tem cinco trabalhos diários que varrem `Appointment`, `GymPayment`,
`GymSubscription`, `GymMembership` e `Program` agrupados por `userId` — **nenhum deles faz join a
`Users`**.

Hoje isso não é problema, porque o CASCADE apaga essas linhas. **Com soft delete, ficam** — e os
crons continuariam a enviar lembretes e a gerar mensalidades para um tenant apagado.

Tem de haver exclusão explícita de tenants apagados nos cinco.

### 6. O que continua a correr lá fora

| | Hoje (hard delete) | Com soft delete |
|---|---|---|
| **Stripe** | ⚠ A linha local cai por CASCADE mas **a subscrição no Stripe não é cancelada** — continua a renovar. Não existe função de cancelamento em `platformBilling.ts`. **É um bug de hoje**, adormecido só por `BILLING_LIVE=false` | Cancelar ao apagar |
| **Umami** | O website fica a existir para sempre — não há função de remoção em `utils/umami.ts` | Igual; decidir se importa |
| **Google OAuth** | Os tokens caem, mas a autorização do lado da Google **continua válida** até o tenant a revogar | Igual; revogar seria o correcto |
| **Push** | Caem com o tenant | Deixam de cair — parar de enviar |

---

## Testes que existem hoje

Três, todos de permissão e happy-path: `admin.test.ts:267-293` (apaga um user **sem dados
associados**), `admin_isolation.test.ts:26-46` (403), `rbac.test.ts:389-396` (403).

**Nenhum cria dados relacionados antes de apagar.** É por isso que a hipótese do 500 nunca foi
apanhada: o único teste que apaga a sério apaga um tenant vazio.

---

## O que está a bloquear

Antes de desenhar mais, é preciso saber **o que a base de dados de produção faz hoje**. Uma query,
contra a BD de produção:

```sql
SELECT TABLE_NAME, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'Users'
ORDER BY DELETE_RULE, TABLE_NAME;
```

O que decide:

- Se aparecer `RESTRICT`/`NO ACTION` em `Appointments`, `Orders`, `Services`, `WorkingHours`,
  `BlockedSlots`, `Addresses` ou `BankCards` → **o apagar está partido hoje** e isto passa a ser
  correcção de bug, não funcionalidade nova.
- Se for tudo `CASCADE` → funciona, e é uma bomba a funcionar.

Em qualquer dos casos o soft delete é a resposta certa. Mas a urgência e a ordem mudam.

---

## Âmbito proposto (depois da verificação)

1. `User` passa a `paranoid` + migração da coluna `deletedAt`.
2. Ao apagar: libertar email e subdomínio, despublicar o site, cancelar a subscrição Stripe.
3. Filtro explícito em `getAdminUserIds` e nos cinco crons.
4. Endpoint de recuperação (restaurar um tenant apagado).
5. **Testes de isolamento a provar que os dados de um tenant apagado não aparecem a mais ninguém** —
   é a regra que não se negoceia. Mais um teste que apaga um tenant **com dados a sério**, que é o
   que nunca existiu.
