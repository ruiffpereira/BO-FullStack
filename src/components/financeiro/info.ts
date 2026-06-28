// Explicações das métricas do Financeiro, mostradas no "i" (InfoDot) → modal.
// Texto em PT, com quebras de linha (renderizado com whitespace-pre-line).

export const INFO: Record<string, { title: string; body: string }> = {
  // ── O Negócio ──
  receita: {
    title: 'Receita (recebido)',
    body: 'O dinheiro que entrou mesmo em caixa no período, somando todos os negócios a que tens acesso (agenda + loja + ginásio). É o "recebido", não o faturado.',
  },
  despesas: {
    title: 'Despesas',
    body: 'O total dos custos do negócio no período, registados no separador Despesas. É o que sai. Alimenta o cálculo do lucro.',
  },
  lucro: {
    title: 'Lucro',
    body: 'Receita − Despesas. O que sobra de facto. A "margem" ao lado é o lucro em percentagem da receita (lucro ÷ receita).',
  },
  revVsExp: {
    title: 'Receita vs Despesas',
    body: 'O que entrou (verde) contra o que saiu (vermelho) ao longo do tempo. Passa o rato por cima de cada barra para ver receita, despesa e lucro desse dia/semana/mês.',
  },
  revSource: {
    title: 'Receita por fonte',
    body: 'De onde vem o teu dinheiro: a fatia de cada negócio (Agenda, Loja, Ginásio) na receita total do período. Só aparecem os módulos que tens ativos.',
  },

  // ── Ginásio · Análise ──
  mrr: {
    title: 'MRR — Receita recorrente mensal',
    body: 'A receita recorrente que devias receber por mês: a soma dos preços das subscrições ativas atribuídas aos alunos.\n\nÉ o esperado (contratado), não o que entrou de facto — para isso vê a Taxa de cobrança.',
  },
  arr: {
    title: 'ARR — Receita recorrente anual',
    body: 'O MRR projetado para um ano: MRR × 12. Útil para pensar o negócio em escala anual.',
  },
  collection: {
    title: 'Taxa de cobrança',
    body: 'De tudo o que devias receber este mês (MRR), quanto entrou mesmo: Recebido ÷ MRR.\n\nÉ o KPI mais importante — revela problemas de cobrança escondidos. Verde se ≥ 80%.',
  },
  activeMembers: {
    title: 'Membros ativos',
    body: 'Nº de alunos com uma subscrição ativa atribuída. Por baixo mostra quantos estão bloqueados (acesso à app suspenso).',
  },
  inactive: {
    title: 'Membros inativos',
    body: 'Alunos que pagam mas não aparecem — sem registar um treino há mais de 14 dias.\n\nÉ um sinal antecipado de quem está prestes a sair, mesmo que ainda pague. Cruza os pagamentos com os treinos na app.',
  },
  churn: {
    title: 'Churn (abandono)',
    body: 'A % de alunos que deixaram de pagar de um mês para o outro: dos que pagaram no mês anterior, quantos não pagaram este mês.\n\nNota: conta tanto quem saiu mesmo como quem só está atrasado — confirma no separador Cobranças.',
  },
  retention: {
    title: 'Retenção',
    body: 'O oposto do churn: a % de alunos que se mantiveram a pagar do mês anterior para este (100 − churn).',
  },
  ltv: {
    title: 'LTV — Valor do aluno ao longo da vida',
    body: 'Quanto um aluno típico te rende no total: média de meses que paga × valor médio por mês pago.\n\nÉ uma estimativa com base no histórico, não uma previsão.',
  },
  mrrTrend: {
    title: 'Tendência do MRR',
    body: 'O dinheiro recebido das mensalidades em cada um dos últimos 6 meses. Mostra se a receita real está a subir ou a descer.',
  },
  waterfall: {
    title: 'Movimento do MRR',
    body: 'Como a receita recorrente mexeu cada mês:\n\n• Verde (ganho) = novos alunos + quem passou a pagar mais.\n• Vermelho (perda) = quem pagou menos + quem deixou de pagar.\n• O número por baixo é o líquido: cresceste ou encolheste nesse mês.',
  },

  // ── Agenda ──
  valorMarcacao: {
    title: 'Valor médio por marcação',
    body: 'Quanto rende, em média, cada marcação concluída: Faturado ÷ nº de marcações concluídas. Sobe quando vendes serviços mais caros ou somas extras.',
  },
  ocupacao: {
    title: 'Ocupação da agenda',
    body: 'Quão cheia está a agenda: tempo marcado ÷ tempo disponível (com base nos teus horários de trabalho). 100% = agenda completamente preenchida. Mostra-te os buracos a preencher.',
  },
  receitaHora: {
    title: 'Receita por hora de cadeira',
    body: 'Quanto rende cada hora de trabalho disponível: Recebido ÷ horas disponíveis no período. É o KPI-rei de uma barbearia/salão — diz se estás a aproveitar bem o tempo.',
  },
  taxaRetorno: {
    title: 'Taxa de retorno',
    body: 'A % das marcações que vêm de clientes que já tinham vindo antes (recorrentes), em vez de clientes novos. Alta = boa fidelização.',
  },
  metodos: {
    title: 'Métodos de pagamento',
    body: 'Como te pagam: a fatia de numerário, MB Way e cartão no recebido do período. Útil para gestão de caixa e fiscalidade.',
  },
  heatmap: {
    title: 'Ocupação por dia e hora',
    body: 'Mapa de calor das marcações por dia da semana e hora. As células mais escuras são os teus picos; as claras, os buracos (ex.: para promoções fora de pico).',
  },
  funil: {
    title: 'Estados das marcações',
    body: 'Quantas marcações estão em cada estado: pendentes, confirmadas, concluídas, canceladas e faltas (não compareceu). As faltas estão separadas dos cancelamentos para medires a receita perdida por quem não aparece.',
  },
  topServicos: {
    title: 'Top serviços',
    body: 'Os serviços que mais faturaram no período, com o nº de vezes que foram feitos. Mostra onde está o teu dinheiro.',
  },

  // ── Loja ──
  margem: {
    title: 'Margem bruta',
    body: 'O que sobra das vendas depois de pagar a mercadoria: Receita − Custo dos produtos (COGS). A % ao lado é a margem em percentagem. Só conta os produtos com custo definido.',
  },
  valorCompra: {
    title: 'Valor médio por compra',
    body: 'Quanto vale, em média, cada encomenda: Faturado ÷ nº de encomendas. Subir isto (vendas adicionais, packs) faz crescer a receita sem precisares de mais clientes.',
  },
  ltvLoja: {
    title: 'LTV do cliente',
    body: 'Quanto te rende, em média, um cliente ao longo de toda a relação: receita total ÷ nº de clientes. Diz-te quanto podes investir para ganhar um cliente novo.',
  },
  taxaRecompra: {
    title: 'Taxa de recompra',
    body: 'A % de clientes que fizeram 2 ou mais compras. Alta = os clientes voltam (a alavanca mais barata de crescimento numa loja).',
  },
  topCategorias: {
    title: 'Top categorias',
    body: 'As categorias de produtos que mais faturaram no período.',
  },
  topProdutos: {
    title: 'Top produtos',
    body: 'Os produtos que mais venderam, com quantidade, faturado, margem (se tiveres custo definido) e stock.',
  },
  stockParado: {
    title: 'Stock parado (dead stock)',
    body: 'Produtos com stock que não vendem há mais de 90 dias, e o valor (a preço de venda) que tens "preso" neles. Capital empatado que podes promover ou liquidar.',
  },
  carrinhos: {
    title: 'Carrinhos abandonados',
    body: 'Carrinhos com produtos que ficaram por finalizar (sem encomenda) há mais de 24h, e o valor aproximado. Recuperar parte disto é receita fácil (ex.: lembrete por email).',
  },
  devolucoesDescontos: {
    title: 'Devoluções e descontos',
    body: 'Devoluções = valor das encomendas reembolsadas no período. Desconto dado = total de descontos/cupões aplicados. Ambos reduzem o que ganhas de facto.',
  },

  // ── Partilhados (Agenda + Loja) ──
  faturacaoTempo: {
    title: 'Faturação ao longo do tempo',
    body: 'A evolução do que faturaste ao longo do período (por dia, semana ou mês, conforme o intervalo). Passa o rato por cima para ver o valor de cada ponto.',
  },
  novos: {
    title: 'Clientes novos',
    body: 'Clientes cuja primeira vez no negócio aconteceu dentro do período. A seta compara com o período anterior.',
  },
  recorrentes: {
    title: 'Clientes recorrentes',
    body: 'Clientes que voltaram — já tinham histórico antes do período. São a base fiel do negócio.',
  },
  perdidos: {
    title: 'Clientes perdidos',
    body: 'Clientes que tinham histórico mas não dão sinal há algum tempo (agenda: ~60 dias; loja: ~90 dias). São os que estão "a fugir" e que vale a pena reconquistar.',
  },
}
