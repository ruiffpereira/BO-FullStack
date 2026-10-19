# Profissionais (multi-staff) — PLANO

> Estado: **decidido (2026-10-19)**, a construir na ronda grande. Fila: `TASKS.md` → Profissionais (dentro do
> B41). Requisitos e respostas do dono: `../equipa-permissoes/PLANO.md` §5 e `DECISOES.md` (2026-10-18 e
> 2026-10-19 · Profissionais).

## Em simples

Um **profissional** é quem atende (o Tiago, o aprendiz). **Não é um login**: um membro da equipa pode estar
ligado a um profissional (e então vê "só o que é dele" se lhe derem esse âmbito), mas um profissional pode existir
sem conta nenhuma. Um negócio **sem profissionais** funciona exactamente como hoje.

## Decisões (todas fechadas)

| Tema | Decisão |
|---|---|
| Serviços | Criados num só sítio; por omissão **todos** os profissionais fazem cada serviço; dá para **tirar** um profissional de um serviço |
| Preço | Preço normal do serviço **+ preço próprio opcional por profissional** (vazio = o normal). Quem pode definir preços: permissão da árvore |
| Horário | Cada profissional tem **horário, férias e folgas próprios**; por omissão herda o do negócio |
| Site | O cliente escolhe o profissional ou **"Qualquer um"** (o primeiro livre). Profissional: caixa **"Aparece no site de marcações"** (marcada por omissão; desmarcada = só marcações feitas no BO). Serviço: **"Disponível no site"** |
| Ocupado | O site recusa uma hora ocupada **desse profissional**; o BO deixa sobrepor (encaixes — DECISOES 2026-10-19) |
| Dono | **Não** é profissional automaticamente; cria-os à mão. Marcações antigas ficam **sem profissional** |
| Financeiro | Por profissional (faturado, recebido, dívida) + o **global**. A venda de produto conta para **quem vendeu**; despesas também se atribuem a um profissional |
| Âmbito do membro | **[Todos \| Só os meus]** na agenda e no financeiro; quem só vê os seus não pode dar "Todos" a ninguém |

## Backoffice — ecrã a ecrã

- **Agenda → Profissionais** (novo separador): lista; **Novo profissional** → nome, foto, cor na agenda, "Aparece
  no site de marcações", serviços que faz (todos marcados por omissão), preço próprio por serviço (campo vazio =
  normal), horário (botão "Igual ao do negócio" / editar dias e horas), férias e folgas, **ligar a um membro** da
  equipa (opcional).
- **Agenda (calendário)**: filtro por profissional (chips por cor) e vista lado a lado no computador; ao criar ou
  editar uma marcação, campo **Profissional** (opcional; mostra o preço desse profissional); aviso não bloqueante
  se a hora já estiver ocupada para ele.
- **Agenda → Serviços**: na ficha do serviço, "Disponível no site" e a lista de quem o faz.
- **Loja → nova venda / encomenda**: campo **Vendido por** (profissional, opcional).
- **Financeiro → Despesas**: campo **Profissional** (opcional).
- **Financeiro** e **Dashboard**: selector **Global · Sem profissional · <cada profissional>**.
- **Equipa → ficha do membro**: separador **Profissional** (ligar/desligar) e o âmbito **[Todos | Só os meus]** na
  agenda e no financeiro.

## Árvore de permissões (regra de 2026-10-19)

Nós novos (nascem **fechados**, também em "Acesso total" para membros já existentes):
`agenda.profissionais` [Ver | Editar] · `agenda.profissionais.precos` [Editar] (preço próprio por profissional;
sem ele o campo aparece só-leitura) · e o **âmbito** [Todos | Só os meus] em `agenda.marcacoes` e nas folhas do
`financeiro`. Os euros continuam a exigir `agenda.marcacoes.valores` / `loja.produtos.custo` (fase 2b).
Aparecem no convite de um utilizador novo como o resto da árvore.

## API

- Modelos novos (migração): `Staff` (tenant, nome, foto, cor, `showOnSite`, `memberId` opcional), `StaffService`
  (quem faz o quê + preço próprio opcional; ausência = faz, com preço normal), `StaffWorkingHours`, `StaffTimeOff`.
  Colunas: `Appointment.staffId`, `Order.soldByStaffId` (ou na linha de venda), `Expense.staffId`,
  `Service.availableOnSite` — todas **nullable**.
- Disponibilidade pública (`controllers/websites/booking/publicController.ts`): por profissional; "Qualquer um" =
  união das horas livres, e ao marcar atribui o primeiro livre **dentro da mesma transacção** (o lock do
  `SLOT_TAKEN` passa a ser por profissional). Sem profissionais → o caminho de hoje, igual.
- Preço da marcação: o do profissional se houver, senão o normal — calculado **na API**, nunca vindo do site.
- Âmbito "Só os meus": filtrado na API pelo `staffId` ligado ao membro (agenda, financeiro, dashboard, sino).
- Todas as rotas com `@swagger` → Kubb no BO e no tifas.

## Site (só o tifas-barber nesta ronda)

Passo novo na marcação: **Com quem?** (fotos + "Qualquer um") → as horas mostradas são as livres dessa escolha;
o preço mostrado é o do profissional. Só aparecem profissionais com "Aparece no site" e serviços "Disponível no
site". Sem profissionais no tenant → o passo não aparece.

## Testes (no fim da ronda)

- `seguranca-api`: profissional/serviço/horário de A nunca usável por B (ids cruzados em todas as rotas);
  "Qualquer um" concorrente não dá duas marcações ao mesmo profissional; o preço não se força pelo site; membro
  "Só os meus" não vê marcações nem euros de colegas (incl. dashboard e sino); quem não tem `precos` não grava preço.
- `pentest-api`: o mesmo, adversarialmente, + escalada pelo âmbito no convite.
- `e2e-backoffice`: criar profissional, tirar de um serviço, preço próprio, férias, marcação com profissional,
  filtros do financeiro, membro "Só os meus"; 1440/834/390.
- tifas: build + marcar com um profissional e com "Qualquer um".

## Do lado do dono

- Criar os profissionais do tifas no BO (e as fotos), dizer quem aparece no site.
- Gate em produção: marcar no tifas com um profissional e com "Qualquer um"; ver o financeiro de cada um e o global;
  um membro "Só os meus" vê só a agenda dele.
