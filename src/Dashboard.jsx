import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Badge, Button, PageHeader, BADGE_TONES } from './ui.jsx';
import { AreaChart, BarChart, DonutChart, Sparkline } from './charts.jsx';
import { fmtEur, VENDAS_MENSAIS, CORTES_SEMANA, CATEGORIAS_VENDA, RECEITA_DIARIA } from './data.js';

// ----------------------------------------------------------------------------
// Dashboard — KPIs + charts that adapt to the active permission's components
// ----------------------------------------------------------------------------
function KpiCard({ label, value, delta, up, icon, spark, sparkColor }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Icon name={icon} className="w-[18px] h-[18px]" /></div>
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            <Icon name={up ? 'arrowUp' : 'arrowDown'} className="w-3.5 h-3.5" />{delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      <div className="flex items-end justify-between mt-1">
        <p className="text-[13px] text-zinc-500">{label}</p>
        {spark && <Sparkline data={spark} color={sparkColor} up={up} />}
      </div>
    </Card>
  );
}

function Dashboard({ perfil }) {
  const has = (c) => perfil.componentes.includes(c);
  const isLoja = has('loja');
  const isAgenda = has('agenda');

  return (
    <div>
      <PageHeader title={`Olá, ${perfil.nome} 👋`} subtitle="Aqui está o resumo do teu negócio esta semana.">
        <Button variant="outline" size="sm" icon="calendar">Junho 2026</Button>
        <Button size="sm" icon="trend">Relatório</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita (mês)" value={fmtEur(5900)} delta="12%" up icon="euro" spark={RECEITA_DIARIA} />
        {isAgenda && <KpiCard label="Cortes esta semana" value="135" delta="8%" up icon="scissors" spark={[14, 18, 16, 22, 19, 28, 34]} sparkColor="#1F8A5B" />}
        {isLoja && <KpiCard label="Encomendas" value="48" delta="5%" up icon="cart" spark={[6, 9, 7, 11, 8, 12, 14]} sparkColor="#1F8A5B" />}
        <KpiCard label="Clientes ativos" value="312" delta="3%" up icon="users" spark={[280, 290, 285, 300, 305, 308, 312]} sparkColor="#7C5CDB" />
        {isLoja ? (
          <KpiCard label="Ticket médio" value={fmtEur(38.4)} delta="2%" up={false} icon="box" spark={[42, 40, 41, 39, 40, 38, 38]} sparkColor="#D97757" />
        ) : (
          <KpiCard label="Taxa de ocupação" value="86%" delta="6%" up icon="clock" spark={[70, 74, 78, 80, 82, 84, 86]} sparkColor="#D97757" />
        )}
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Receita mensal</h3>
              <p className="text-[13px] text-zinc-500">Últimos 6 meses</p>
            </div>
            <Badge tone="green" dot>+18% YoY</Badge>
          </div>
          <AreaChart data={VENDAS_MENSAIS} valueKey="v" labelKey="m" format={fmtEur} height={210} />
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">{isLoja ? 'Vendas por categoria' : 'Serviços mais pedidos'}</h3>
          <p className="text-[13px] text-zinc-500 mb-5">Distribuição este mês</p>
          <DonutChart data={isLoja ? CATEGORIAS_VENDA : [
            { nome: 'Corte', v: 48, cor: '#2A6FDB' },
            { nome: 'Corte + Barba', v: 30, cor: '#1F8A5B' },
            { nome: 'Barba', v: 14, cor: '#D97757' },
            { nome: 'Outros', v: 8, cor: '#E6B450' },
          ]} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">{isAgenda ? 'Cortes por dia' : 'Encomendas por dia'}</h3>
          <p className="text-[13px] text-zinc-500 mb-4">Esta semana</p>
          <BarChart data={CORTES_SEMANA} valueKey="v" labelKey="d" height={190} />
        </Card>

        {/* Activity feed */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Atividade recente</h3>
            <Button variant="ghost" size="sm">Ver tudo</Button>
          </div>
          <div className="space-y-1">
            {[
              { icon: isAgenda ? 'scissors' : 'cart', tone: 'blue', txt: isAgenda ? 'Nova marcação — Corte + Barba' : 'Nova encomenda #1042', who: 'Marta Sousa', t: 'há 12 min' },
              { icon: 'users', tone: 'violet', txt: 'Novo cliente registado', who: 'Bruno Faria', t: 'há 1 h' },
              { icon: isLoja ? 'box' : 'check', tone: 'green', txt: isLoja ? 'Stock reposto — Óleo para Barba' : 'Marcação confirmada', who: 'Sistema', t: 'há 2 h' },
              { icon: 'euro', tone: 'amber', txt: 'Pagamento recebido ' + fmtEur(92), who: 'Rita Gomes', t: 'há 3 h' },
              { icon: 'ban', tone: 'red', txt: isAgenda ? 'Marcação cancelada' : 'Encomenda cancelada #1038', who: 'Inês Carvalho', t: 'ontem' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[a.tone]}`}><Icon name={a.icon} className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{a.txt}</p>
                  <p className="text-xs text-zinc-400">{a.who}</p>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{a.t}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export { Dashboard };
