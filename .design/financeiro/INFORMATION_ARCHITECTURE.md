# Information Architecture: Financeiro

> Lente do **dinheiro** sobre os verticais. As páginas operacionais (`/agenda`, `/loja`,
> `/ginasio`) já existem e ficam intactas — o Financeiro não as substitui, agrega-as por € e qualidade.

## Site Map

```
/financeiro                         ← Página Financeiro (core, todos os tenants). Tabs internas:
  ?vista=negocio   (default)        ← "O Negócio" — consolidado (sempre visível)
  ?vista=agenda                     ← Financeiro Agenda      (só se VIEW_SCHEDULE)
  ?vista=loja                       ← Financeiro Loja        (só se VIEW_PRODUCTS)
  ?vista=ginasio                    ← Financeiro Ginásio     (só se VIEW_GYM)
    · cobrancas (sub-tab, default)
    · clientes  (sub-tab)           ← NOVO: roster de alunos
    · subscricoes (sub-tab)
    · analise   (sub-tab)
  ?vista=despesas                   ← Despesas (sempre visível; é "core")

/despesas                           ← deep-link legado → /financeiro?vista=despesas
```

Regras de visibilidade:
- **O Negócio** e **Despesas** aparecem sempre.
- **Agenda / Loja / Ginásio** aparecem só com a respetiva permissão.
- Se o tenant tiver **um só** vertical → o Financeiro abre **nesse** vertical (não em "O Negócio"),
  porque o consolidado de um só negócio é redundante.
- Se tiver **2+** verticais → abre em "O Negócio".
- "O Negócio" mostra blocos **só dos verticais a que o tenant tem acesso** (composição por permissões).

## Navigation Model

- **Primary navigation** (sidebar, `Shell.tsx`): mantém-se. "Financeiro" continua uma entrada única
  com ícone `euro`. Não acrescentamos entradas por vertical na sidebar (evita poluição) — a divisão
  por negócio vive nas **tabs internas**.
- **Secondary navigation** (tabs no topo da página): O Negócio · Agenda · Loja · Ginásio · Despesas.
  Máx. 5, gated por permissão. Estado da tab na **URL** (`?vista=`) → linkável e bookmarkável.
- **Tertiary** (só no Ginásio): sub-tabs Cobranças · Clientes · Subscrições · Análise.
- **Utility**: o **PeriodPicker** (Hoje/Semana/Mês/Último mês/Ano/Personalizado) e o **toggle c/IVA·s/IVA**
  ficam no cabeçalho da página, **partilhados** entre tabs (trocar de vertical mantém o período).
- **Mobile navigation**: tabs com scroll horizontal (sem hambúrguer); sub-tabs do ginásio idem.
  A barra de cobrança em massa fixa-se no fundo do ecrã.

## Content Hierarchy

### O Negócio (consolidado)
1. **Score de saúde do negócio** — anel 0–100 + tom; é a resposta a "como vai o negócio". Topo.
2. **Tríade de dinheiro total** — Faturado · Recebido · Em dívida (soma dos verticais acessíveis).
3. **Lucro + margem** — Receita − COGS − Despesas; delta vs período anterior.
4. **Distribuição de receita por fonte** — donut Agenda/Loja/Ginásio.
5. **Tendência receita · despesa · lucro** — gráfico de área no tempo.
6. **Top global** — melhores serviços/produtos/planos lado a lado.
7. **Despesas por categoria** (resumo) + atalho para a tab Despesas.

### Financeiro Agenda
1. **Tríade**: Faturado (Σ `servicePrice` de marcações não-canceladas) · Recebido (Σ pagamentos por `paidAt`) · Em dívida (Σ `servicePrice − pago`).
2. **Valor médio por marcação** + **Receita por hora de cadeira** (ocupação = receita ÷ horas disponíveis).
3. **Lucro** (receita − despesas; serviços não têm COGS).
4. **Receita no tempo** (área) + **método de pagamento** (donut numerário/MBWay/cartão).
5. **Qualidade**: Novos · Recorrentes · **Perdidos (sem marcar há ~60d)** · taxa de retorno/rebooking.
6. **Heatmap dia × hora** (ocupação) + **Top serviços**.
7. **Funil de estados** (pending → confirmed → completed / cancelled / **no-show**).

### Financeiro Loja
1. **Tríade**: Faturado (encomendas **excl. cancelled/refunded**) · Recebido · Em dívida (se aplicável).
2. **Margem bruta** = Receita − **COGS** + **Valor médio por compra**.
3. **Lucro** (margem − despesas) + **% de produtos com custo definido** (qualidade do dado).
4. **Receita + nº encomendas no tempo** (área/barras) + **devoluções/reembolsos** + **desconto dado**.
5. **Qualidade**: Novos · Recorrentes · **Perdidos (sem comprar há ~90d)** · **taxa de recompra** · **LTV**.
6. **Top produtos / categorias** (com margem) + **carrinhos abandonados**.
7. **Inventário**: stock baixo · **stock parado (dead stock)** · valor de stock por categoria.

### Financeiro Ginásio
1. **Cockpit de cobrança** (sub-tab Cobranças): Recebido / Previsto (MRR) + barra %, Por cobrar, Em atraso.
   **Gerar mês** (cria mensalidades em falta) + **cobrança em massa** (selecionar → marcar pagos / lembrar).
2. **Clientes** (sub-tab NOVA): roster com foto, plano, estado do mês, assiduidade; clique → ficha.
3. **Subscrições** (catálogo) — como hoje.
4. **Análise**: MRR · **ARR** · **Taxa de cobrança** · Churn · Retenção · LTV · **MRR waterfall** · tendência.
5. **Em risco**: em atraso há >X dias + **paga mas não treina há N semanas** (cruzar `WorkoutLog`).

### Despesas
1. Total do período + variação. 2. Por categoria (barras + cor). 3. No tempo. 4. Tabela CRUD. (Mantém-se.)

## User Flows

### Ver a saúde do negócio (dono multi-vertical)
1. Abre `/financeiro` → cai em **O Negócio**.
2. Vê o **Score de saúde** + tríade total + lucro.
3. Expande o score → percebe que baixou por **% em dívida** alta.
4. Clica no fator "em dívida" → vai para o vertical com mais dívida (ex.: Ginásio → Cobranças).

### Cobrar mensalidades do mês (ginásio)
1. Financeiro → **Ginásio → Cobranças**. Período = mês atual.
2. Se faltam mensalidades → **Gerar mês** cria as linhas em falta.
3. Filtra "Por cobrar" → seleciona vários → **Marcar pagos** (ou abre 1 e regista detalhe).
   - Se em atraso → opção **Enviar lembrete** (notificação).
4. Barra "Recebido / Previsto" sobe; quem fica em atraso destaca-se a vermelho.

### Recuperar clientes a fugir (agenda/loja)
1. Vertical → secção **Perdidos** (sem atividade há N dias).
2. Vê a lista ordenada por valor histórico.
3. Ação **Contactar** (email/notificação) ou abre a ficha do cliente.

### Definir custo para ver margem (loja)
1. Loja → vê **"margem disponível para X% dos produtos"**.
2. Clica → lista de produtos sem custo → preenche `cost`.
3. Margem e lucro da loja atualizam.

## Naming Conventions

| Conceito | Label na UI | Notas |
|---|---|---|
| Receita vendida/marcada | **Faturado** | o que vendeste no período (base de competência) |
| Dinheiro entrado | **Recebido** | pagamentos efetivos (caixa) |
| Por receber | **Em dívida** | faturado − recebido |
| Receita − COGS | **Margem** | só na loja (precisa de custo) |
| Margem − despesas | **Lucro** | usado em todos os verticais |
| Custo da mercadoria | **Custo** (COGS) | campo no produto + snapshot na encomenda |
| Média €/transação (agenda) | **Valor médio por marcação** | substitui "ticket médio" |
| Média €/transação (loja) | **Valor médio por compra** | substitui "ticket médio" |
| Média €/aluno (ginásio) | **Receita média por aluno** | substitui "ticket médio" |
| Cliente sem atividade há N dias | **Perdido** / "a fugir" | N configurável |
| Receita recorrente mensal | **MRR** | mantém sigla (já em uso) |
| Faltou sem avisar | **Não compareceu** (no-show) | novo estado de marcação |
| Score 0–100 | **Saúde do negócio** | composto, com breakdown |

## Component Reuse Map

| Componente | Usado em | Diferenças de comportamento |
|---|---|---|
| `FinanceiroPage` (shell + tabs + período + IVA) | toda a feature | tabs e blocos filtrados por permissão |
| `KpiCard` (unificado) | todos os verticais + O Negócio | tom semântico e delta variam |
| `MoneyTriad` | Agenda, Loja, Ginásio, O Negócio | fontes de dados diferentes; mesmo layout |
| `PeriodPicker` | cabeçalho partilhado | estado na URL, partilhado entre tabs |
| `AreaTrend` / `DonutChart` (recharts) | vários | séries diferentes |
| `HealthScore` | O Negócio | — |
| `LostCustomersList` | Agenda, Loja | janela N e ação de contacto diferem |
| `BulkChargeBar` | Ginásio (Cobranças/Clientes) | — |
| `ClienteMensalidade` (existe) | Ginásio Clientes + ficha do cliente | já tem modo `dense` |

## Content Growth Plan

- **Top listas** (serviços/produtos/planos): limitadas a N (5–8) com "ver todos" → página/tabela paginada.
- **Clientes perdidos / roster**: pesquisa + paginação; crescem com a base de clientes.
- **Histórico de pagamentos / encomendas**: paginado por período; navegação mês-a-mês (já existe no ginásio).
- **Séries temporais**: agregação adapta-se ao período (dia → semana → mês) como o dashboard já faz.
- **Novos verticais futuros** (ex.: aulas, restauração): entram como mais uma tab gated — a IA não muda.

## URL Strategy

- Padrão: `/financeiro?vista=<negocio|agenda|loja|ginasio|despesas>`; sub-tab do ginásio
  `&aba=<cobrancas|clientes|subscricoes|analise>`.
- Período/IVA podem ir em query também (`&periodo=month&iva=com`) para partilha exata de uma vista.
- Manter `/despesas` → redireciona/abre `?vista=despesas` (compat).
- Se a `vista` pedida não tiver permissão → cai em `negocio` (ou no único vertical disponível).
- Sidebar continua a apontar a `/financeiro` (sem sub-itens).
```