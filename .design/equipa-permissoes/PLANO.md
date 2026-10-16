# Equipa e permissões em árvore — PLANO

> Estado: **planeado (2026-10-16)**, por fases. Decisões fechadas, fora a revisão da árvore (fase 2).
> Fila: `TASKS.md` → B40 (admin intocável, primeiro) e B41 (este épico).

## O que o dono pediu

- Cada tenant cria utilizadores (a "equipa") e dá-lhes permissões.
- Permissões **em árvore**: dar o módulo inteiro, abrir o módulo e retirar partes, e assim
  sucessivamente até à acção.
- Cada nó com **ver** ou **editar** (ex.: o barbeiro vê mas não edita).
- **Âmbito**: um utilizador pode ficar limitado aos *seus* dados (ex.: só a agenda dele).
- Sem billing por lugar, por agora.

## Como está hoje (o ponto de partida)

- Cada `User` **é** um tenant. `req.user` = `userId` do tenant em todo o lado; o isolamento assenta nisto.
- RBAC global: `Permission` (papel) → `ComponentPermission` → `Component` (`VIEW_SCHEDULE`, `VIEW_GYM`…).
  Um `User` tem **um** papel. Gate por **módulo inteiro**, montado em `routes/index.ts`; ler e escrever
  dá no mesmo.
- Várias rotas só têm `authenticateToken` (dashboard, financeiro/negócio, settings, uploads,
  notificações, cms/search…) — "core": quem entra vê.
- Precedente útil: a **sessão de suporte** já separa *quem age* (`req.impersonatorId`) de *de quem são
  os dados* (`req.user`), com revalidação por pedido e `forbidDuringImpersonation`. A equipa segue o
  mesmo molde.

## Desenho

### 1. Identidade — o membro não é um `User`

Tabela nova `TeamMembers` (`memberId`, `ownerUserId` → tenant, `name`, `email`, `password`,
`tokenVersion`, `status` invited/active/disabled, `createdByMemberId`, `staffId` nulo até ao multi-staff,
`lastLoginAt`).

**Porquê não um `User`:** um `User` aparece no Admin, no billing, no Umami, no `getAdminUserIds`, nos
site tokens e no apagar tenant. Meter membros lá obrigava a filtrar cada um desses sítios e um esquecimento
transformava um barbeiro num tenant.

- **Login**: o mesmo ecrã do BO. A API procura em `Users` e depois em `TeamMembers`; o email é único
  entre as duas tabelas (409 ao convidar um email já usado).
- **JWT**: `{ userId: <tenant>, memberId, tokenVersion }`. O `authenticateToken` ganha o ramo `memberId`
  (como o ramo `imp`): revalida a cada pedido (membro existe, activo, `tokenVersion` bate, tenant existe)
  e põe `req.user = tenant`, `req.memberId`, `req.actorName`. O resto do código continua a filtrar por
  `req.user` sem mudar uma linha.
- **Convite** por email com link de definição de password (o padrão `setupToken` que já existe).
- **Desactivar/remover** → `tokenVersion++` → a sessão morre no pedido seguinte.
- **Auditoria**: `AuditLog.actorUserId` passa a registar o membro (já existe para o suporte).

### 2. Catálogo de permissões — em código, em árvore

Um ficheiro (`src/permissions/catalog.ts`) com a árvore. Não vive na BD: muda com o código e é
testável. Cada folha tem `ver`/`editar` e, onde faz sentido, um âmbito (`todos` | `meus`).

Primeiro corte, tirado das rotas e páginas reais (a validar com o dono no início da fase 2):

```
Agenda                    (requer VIEW_SCHEDULE no tenant)
├─ Marcações              ver · editar · âmbito todos|meus
│  ├─ Valores e pagamentos  ver · editar      ← preço, dívida, pagamentos no PUT
│  └─ Notificar cliente     executar
├─ Serviços               ver · editar
├─ Horários e bloqueios   ver · editar · âmbito todos|meus   (férias incluídas)
├─ Configuração           ver · editar        (grelha, slotMinutes)
└─ Calendário (.ics)      ver                 (o feed é uma credencial)
Loja                      (VIEW_PRODUCTS)
├─ Produtos               ver · editar
│  └─ Custos (COGS)         ver
├─ Categorias             ver · editar
├─ Encomendas             ver · editar
└─ Cupões                 ver · editar
Ginásio                   (VIEW_GYM)
├─ Catálogo (exercícios, grupos)   ver · editar
├─ Treinos e planos       ver · editar
├─ Sócios                 ver · editar · convidar
│  └─ Programas do sócio    ver · editar
└─ Mensalidades           ver · editar        (registar pagamento, bulk-pay, lembretes, gerar)
Clientes                  (VIEW_CUSTOMERS)
├─ Lista e ficha          ver · editar
│  └─ Histórico            ver
└─ Leads                  ver · editar
Financeiro / Despesas
├─ Negócio (consolidado)  ver
├─ Agenda · Loja · Ginásio  ver   (cada um exige também o módulo)
└─ Despesas               ver · editar
Conteúdos                 (VIEW_CMS)
├─ Textos do site / produtos / serviços / ginásio  ver · editar
├─ Línguas                ver · editar
└─ Emails e notificações  ver · editar
Páginas (construtor)      (VIEW_SITE_PAGES)   ver · editar · publicar
Estatísticas do site      ver
Dashboard                 ver   (cada cartão só mostra o que o membro pode ver)
Mensagens                 ver · responder
Equipa                    ver · gerir
```

**Nunca delegável** (só o dono do tenant): Faturação/billing, Perfil do negócio e credenciais, Acesso
de suporte, Integrações Google, Chat de suporte, apagar a conta, domínio. **Nunca aparece**: tudo o que é
`VIEW_ADMIN`.

**Regra da árvore**: marcar um nó marca os filhos; desmarcar um filho deixa o pai em "parcial"; `editar`
implica `ver`. O que se guarda são **as folhas** (`TeamMemberGrants`: `memberId`, `key`, `level`
ver|editar, `scope`), nunca o pai — assim um nó novo acrescentado ao catálogo **nasce fechado** para os
membros existentes (default-deny).

**Tecto**: ninguém dá o que não tem. Para o dono, o tecto são os módulos do tenant (os `Component`
actuais). Para um membro com `Equipa → gerir`, o tecto são as suas próprias folhas, com o mesmo nível e
âmbito ou menos. Retirar uma folha a um membro **cascateia** para quem ele criou.

### 3. Aplicação na API — default-deny para membros

- Middleware `can(key, level)` em **cada** rota do BO (junto ao `authorizePermissions`, que fica para o
  gate de módulo do tenant). Dono do tenant (sem `memberId`) → passa como hoje. Membro → precisa da folha.
- Leitura (`GET`) = `ver`; escrita = `editar`; as excepções (notificar, publicar, convidar) declaradas.
- **Teste-guardião**: percorre a pilha do Express e falha se alguma rota com `authenticateToken` não
  declarar chave nem estiver na lista "só o dono". Uma rota nova esquecida nunca fica aberta a membros —
  o mesmo princípio do `@swagger` obrigatório.
- **Âmbito `meus`**: o controller filtra por `staffId` do membro. Depende do multi-staff (secção 5).
- **Campos sensíveis**: sem `Valores e pagamentos`, as marcações saem sem preço/pagamentos; sem
  `Custos`, os produtos saem sem COGS. Filtro na serialização, com teste por campo.
- **Agregados** (dashboard, financeiro): cada bloco só é calculado se o membro tem a folha — senão
  nem é consultado.
- **Notificações/SSE/push**: só os tipos dos módulos que o membro vê. Subscrições de push por membro.

### 4. Backoffice

- `AuthContext` passa a expor `can(key, level)` a partir de `GET /users/me/access` (folhas efectivas,
  calculadas na API — nunca no frontend).
- **Shell**: a sidebar e os submenus filtram por `can`; o guard de rota já existente redirige.
- **Ver sem editar**: o `useWriteGuard` ganha o motivo "sem permissão para editar" ao lado do de
  billing → todos os `GuardButton` existentes passam a respeitá-lo com o tooltip certo. Formulários
  em modo leitura.
- **Página Equipa** (`/equipa`, no menu do avatar, ao lado do Perfil): lista (nome, email, estado,
  último acesso), Convidar, Editar, Desactivar, Remover, Reenviar convite. O editor de permissões é a
  árvore: caixas de três estados, `Ver`/`Editar` por nó, âmbito `Todos/Só os meus` onde existe, e
  **modelos rápidos** ("Só ver tudo", "Recepção", "Profissional") para não montar a árvore à mão.
  Funciona a 1440/834/390.
- Topbar mostra quem está ligado ("Ana · equipa de Tifas").

### 5. "Só a agenda dele" — precisa de multi-staff

Hoje uma marcação não tem profissional. Para o âmbito `meus` existir:

- Entidade `Staff` (profissional) por tenant; `Appointment.staffId`; horários e bloqueios por profissional;
  serviços que cada um faz.
- Booking público passa a poder escolher o profissional (ou "qualquer um") — toca nos sites externos
  (`tifas-barber`, `ricardo-barber`…), regra cross-repo.
- Um membro liga-se a um `Staff` → o âmbito `meus` filtra por ele.

É o item 6 do ROADMAP ("Multi-staff"), do tamanho de um épico próprio. Por isso fica num **épico à parte, depois das fases 0–3**:
até lá o âmbito aparece desligado ("em breve").

## Fases — cada uma fecha a funcionar em produção

> Decisão do dono (2026-10-16): por fases, cada uma a funcionar antes da seguinte. A numeração continua no
> Correio (fases 4–9, `.design/email/PLANO.md`). Ordem e estado vivem no `TASKS.md`.
> Cada fase: commit + push + CI verde → passos do dono em produção (migrações, envs) → gate do dono.

### Fase 0 · Admin intocável (B40)
**Vês a funcionar:** na tua linha em Admin → Utilizadores já não há Eliminar nem seletor de permissão; a
role `Admin` não aparece para dar a ninguém; a API recusa mesmo chamada à mão. Ver "Acções" abaixo.

### Fase 1 · Equipa por módulo
**Vês a funcionar:** a Barbearia convida a recepcionista; ela recebe o email, define a password, entra no
mesmo login e vê **só a Agenda e os Clientes**, com a Agenda **só para ver** (botões desactivados com "Só
tens permissão para ver"). Desactivá-la tira-lhe o acesso no pedido seguinte.
- Árvore só com o primeiro nível (os módulos), cada um **[Ver | Editar]**. A estrutura de dados já é a da
  árvore inteira (folhas), por isso a fase 2 só acrescenta nós.
- API: `TeamMembers` + migração, convite, login, ramo `memberId` no `authenticateToken`, refresh/logout;
  `can()` em todas as rotas com a lista "só o dono"; teste-guardião; `/team`.
- BO: menu do avatar → **Equipa** (lista, convidar, editar, desactivar, remover, reenviar convite),
  `can()` no `AuthContext`, Shell, `useWriteGuard` com o motivo "sem permissão", topo com "Ana · equipa
  de…", perfil do membro.
- Agentes: auth → `seguranca-api` + `pentest-api` antes do commit; `e2e-backoffice` + `design-review`.
- **Tamanho: a maior das fases** (auth + todas as rotas). Não dá para partir sem deixar o sistema
  meio-feito: um membro com acesso só a metade das rotas protegidas seria um buraco.

### Fase 2 · Árvore completa
**Vês a funcionar:** abrir a Agenda na árvore e tirar **Valores e pagamentos** — o barbeiro vê as
marcações sem preços nem dívidas; o Dashboard e o Financeiro só lhe mostram o que pode ver; as
notificações também. Modelos rápidos (*Só ver tudo*, *Recepção*, *Profissional*).
- Catálogo completo (revisto contigo no início desta fase), campos sensíveis filtrados na API,
  agregados, notificações por membro.

### Fase 3 · Delegação
**Vês a funcionar:** o barbeiro recebe **Equipa → Gerir** e convida um ajudante; a árvore só lhe deixa
dar o que ele tem; tirar-lhe uma permissão tira-a também ao ajudante. Separador **Actividade** na ficha do
membro (o que ele fez).
- Fecha com o `pentest-api` sobre a equipa toda (membro de A contra B, membro contra o dono, escalada).

### Depois (épico à parte): Profissionais / multi-staff
Âmbito **[Todos | Só os meus]** na agenda, horários por profissional, escolha do profissional no site de
marcações (sites externos). Entra na fila quando as fases 0–3 estiverem fechadas.

## Acções no Backoffice — ecrã a ecrã

Três pessoas: **tu** (o único admin da plataforma), o **tenant** (dono do negócio) e o **membro** (alguém
da equipa do tenant).

### B40 — Admin intocável (tu)

| Onde | Hoje | Depois |
|---|---|---|
| Admin → Utilizadores → a tua linha | Editar · Eliminar · Reset password · Domínio · Construtor | Badge **"Acesso total"**. Sai **Eliminar**. Em **Editar**, a permissão aparece fixa ("Admin"), sem seletor |
| Admin → Utilizadores → **Novo utilizador** / **Editar** de um tenant | Seletor com todas as roles | O seletor **não mostra** a role `Admin` nem roles com `VIEW_ADMIN` |
| Admin → Permissões → linha `Admin` | Editar · Eliminar | Cadeado, **só leitura** (mostra os componentes, não deixa mexer) |
| Admin → Componentes → linha `VIEW_ADMIN` | Editar · Eliminar | Cadeado, só leitura |

A API recusa as mesmas coisas com 403 mesmo que alguém chame o endpoint à mão.

### B41 — Equipa (fases 1–3)

**Tu (Admin → Utilizadores)**
- Coluna nova **Equipa** com o número de membros do tenant.
- Na linha do tenant, acção **"Equipa"** → lista só de leitura (nome, email, estado, último acesso). Para
  suporte; mexer na equipa é com o tenant. Com **"Entrar como"** vês o BO como o tenant, incluindo a
  página Equipa.

**Tenant — menu do avatar → "Equipa"** (página nova `/equipa`, ao lado do Perfil)
- Lista: nome · email · estado (Convidado / Activo / Desactivado) · último acesso · criado por.
- **Convidar utilizador** → nome, email, ponto de partida (*Só ver tudo* · *Recepção* · *Profissional*
  · *Personalizado*), e **☐ Dar-lhe um endereço de email** (cria `nome@negocio`; só com o módulo Correio,
  ver `.design/email/PLANO.md`) → envia o convite por email.
- Clicar num membro abre a ficha com dois separadores:
  - **Permissões** — a árvore. Cada nó: caixa (marcado / parcial / vazio) + **[Ver | Editar]**. O nó
    **Equipa** tem **[Ver | Gerir]**: "Gerir" é o que deixa este membro criar utilizadores (sempre só até
    às permissões dele). O âmbito **[Todos | Só os meus]** aparece desactivado com "chega com os
    profissionais" até ao épico dos Profissionais.
  - **Actividade** — o que este membro fez (vem do registo de auditoria).
- Acções na ficha: **Guardar permissões** · **Reenviar convite** · **Desactivar / Reactivar** ·
  **Terminar sessões** · **Remover**.
- Ao retirar uma permissão a um membro que criou outros, o BO avisa: "Também sai a N utilizadores criados
  por este membro".

**Membro**
- **Convite** → link no email → define a password (o mesmo ecrã `SetupPassword`) → entra.
- Entra pelo **mesmo login** do BO.
- A sidebar e os submenus só mostram o que lhe foi dado.
- Onde só tem "Ver": os botões de escrita ficam desactivados com o tooltip **"Só tens permissão para
  ver"** (o mesmo mecanismo do aviso de billing) e os formulários abrem só de leitura.
- O topo mostra **"Ana · equipa de Tifas Barber"**.
- **Perfil do membro**: nome, password e tema. Não vê os dados do negócio, a Faturação nem o Acesso de
  suporte.
- Se tiver **Equipa → Gerir**: vê a página Equipa, mas só os membros que criou, e a árvore só lhe deixa
  marcar o que ele próprio tem.

### Depois — Profissionais (multi-staff), para referência

- **Agenda → Profissionais** (tenant): criar profissional, serviços que faz, horário próprio, ligar a
  um membro.
- Na ficha do membro, terceiro separador **Profissional**; o âmbito **[Todos | Só os meus]** passa a
  funcionar.
- No site de marcações: escolher o profissional ou "qualquer um".

## Decisões do dono

Fechadas (2026-10-16, ver `DECISOES.md`):
- Há **um só admin**, o dono; a role `Admin` não se atribui a mais ninguém (B40).
- **Delegação: sim**: um membro pode criar utilizadores dentro das suas permissões, se o tenant lhe der
  `Equipa → Gerir`.
- **Multi-staff num épico à parte**, depois das fases 0–3.
- **Por fases**, cada uma a funcionar em produção antes da seguinte.

- **Âmbito**: quem cria um utilizador escolhe se ele vê **a agenda de todos** ou **só a dele**, e um membro
  que só vê a dele não pode dar "todos" a ninguém (confirmado pelo dono).
- **Email por membro opcional**, escolhido no convite.

Em aberto:
1. A árvore acima — o que falta, o que sobra, que nomes. Revê-se no início da fase 2, com o dono
   (a fase 1 só usa o primeiro nível).
