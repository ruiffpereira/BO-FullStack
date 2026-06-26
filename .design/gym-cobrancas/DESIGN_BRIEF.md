# Design Brief — Cobranças do Ginásio (reinvenção do "Financeiro do Ginásio")

_2026-06-26 · substitui a tab confusa "Mensalidades" (KPIs + folha-de-cálculo + "Gerar mês" + 4 estados na tabela)._

## Problema
A área de mensalidades do ginásio ficou confusa: demasiados conceitos (subscrição/mensalidade/pagamento/estado), geração manual do mês, uma tabela que também editava (ações inline a mudar estado por engano), e lógica espalhada por Financeiro/Clientes.

## Decisões (validadas com o utilizador)
- **Cobrança manual** no ginásio (numerário/MBWay/transferência) → a ação central é "marcar pago".
- **Importam as duas coisas**: cobrar em atraso **e** ver os números → cockpit com resumo + lista.
- **Auto-mês**: acabou o botão "Gerar mês". Cada cliente com plano ativo aparece automaticamente como "por cobrar"; marcar paga/dívida cria o registo via upsert.

## Conceito: cockpit de cobranças
A tela responde a **uma** pergunta: *"Quem é que ainda me falta cobrar este mês?"* e cobra-se num clique.

**Financeiro → Ginásio** tem 2 sub-tabs:
1. **Cobranças** (`CobrancasView`):
   - Seletor de mês (‹ Junho 2026 ›, navega meses; usa `GET /gym/mensalidade/finance?period=`).
   - Resumo: **Recebido €X / €Y previsto** (barra), **Por cobrar (€)**, **Em atraso**, **MRR**.
   - Segmentação **Por cobrar · Pagos · Todos** (com contagens) + pesquisa.
   - Lista (em atraso primeiro): avatar · nome · plano · contexto ("venceu há 4 dias" / "falta €X" / "pago · método"). **Uma** ação: **Marcar pago** (abre `PagamentoModal`: método + data). Clicar na linha → ficha do cliente.
   - **Sem** ações de mudar estado na própria linha (evita enganos e apagar pagamentos).
2. **Subscrições** (`SubscricoesTab`): catálogo dos planos (CRUD).

**Ficha do cliente / drawer** (`ClienteMensalidade`): cartão único (subscrição → mês corrente → bloqueio). Mês corrente é **automático** (efémero "por pagar" se ainda não há registo). Baixar de "pago" → confirmação (apaga o registo). Mostra **"Registado a {data + hora}"**.

## Como absorve os pedidos soltos
- "Não quero mudar a dívida na tabela" → removidas as ações inline; só "Marcar pago".
- "Filtro de quem pagou / não pagou" → segmentação Por cobrar/Pagos/Todos.
- "Vencimento é sempre dia 8" → fora da tabela; mostrado em contexto ("venceu há Nd").
- "Registar dia e hora" → `GymPayment.updatedAt` exposto (`serializePayment`) e mostrado.
- Filtros de calendário (Hoje/Semana/Mês/Ano/Personalizado) → pertencem ao **Financeiro → O Negócio** (item separado, ainda por afinar).

## Backend
Sem novas tabelas. `getFinance` já aceita `?period=` e lista todos os membros (auto-mês). `serializePayment` passou a devolver `updatedAt`/`createdAt` (ISO) para o carimbo data+hora.
