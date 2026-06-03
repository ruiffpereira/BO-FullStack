import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Button, Badge, Input, Avatar, Modal, PageHeader, EmptyState } from './ui.jsx';
import { fmtEur, CLIENTES_FINAIS } from './data.js';

// ----------------------------------------------------------------------------
// Clientes — end customers of the business. Detail adapts to permission.
// ----------------------------------------------------------------------------
const { useState: useStateCli, useMemo: useMemoCli } = React;

const ESTADO_CLI = {
  ativo: { t: 'Ativo', tone: 'green' },
  vip: { t: 'VIP', tone: 'violet' },
  bloqueado: { t: 'Bloqueado', tone: 'red' },
};

function Clientes({ perfil }) {
  const isLoja = perfil.componentes.includes('loja');
  const [clientes, setClientes] = useStateCli(CLIENTES_FINAIS);
  const [q, setQ] = useStateCli('');
  const [filtro, setFiltro] = useStateCli('todos');
  const [sel, setSel] = useStateCli(null);

  const filtered = useMemoCli(() => clientes.filter((c) =>
    (filtro === 'todos' || c.estado === filtro) && (c.nome.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()))
  ), [clientes, q, filtro]);

  const toggleBloqueio = (id) => setClientes(clientes.map((c) => (c.id === id ? { ...c, estado: c.estado === 'bloqueado' ? 'ativo' : 'bloqueado' } : c)));

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${clientes.length} clientes finais registados no teu negócio.`}>
        <Button variant="outline" size="sm" icon="filter">Exportar</Button>
        <Button icon="plus" size="sm">Adicionar cliente</Button>
      </PageHeader>

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome ou email…" className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['todos', 'Todos'], ['ativo', 'Ativos'], ['vip', 'VIP'], ['bloqueado', 'Bloqueados']].map(([id, l]) => (
              <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition ${filtro === id ? 'bg-accent text-white border-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium px-4 sm:px-5 py-3">Cliente</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Contacto</th>
                <th className="font-medium px-4 py-3">{isLoja ? 'Encomendas' : 'Visitas'}</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">Total gasto</th>
                <th className="font-medium px-4 py-3 hidden lg:table-cell">Última</th>
                <th className="font-medium px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setSel(c)} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer">
                  <td className="px-4 sm:px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.nome} color={c.avatar} size={36} />
                      <div className="min-w-0"><p className="font-medium text-zinc-900 dark:text-white truncate">{c.nome}</p><p className="text-xs text-zinc-400 truncate md:hidden">{c.email}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden md:table-cell"><p className="truncate">{c.email}</p><p className="text-xs text-zinc-400">{c.telefone}</p></td>
                  <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-100 tabular-nums">{c.visitas}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 tabular-nums hidden sm:table-cell">{fmtEur(c.gasto)}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{c.ultima}</td>
                  <td className="px-4 py-3"><Badge tone={ESTADO_CLI[c.estado].tone} dot>{ESTADO_CLI[c.estado].t}</Badge></td>
                  <td className="px-4 py-3 text-right"><Icon name="chevronRight" className="w-4 h-4 text-zinc-300 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState icon="users" title="Sem clientes" desc="Não há clientes que correspondam aos filtros." />}
        </div>
      </Card>

      {/* Detail modal */}
      {sel && (
        <Modal open onClose={() => setSel(null)} title="Ficha de cliente" width="max-w-xl"
          footer={<>
            <Button variant="ghost" icon="ban" onClick={() => { toggleBloqueio(sel.id); setSel({ ...sel, estado: sel.estado === 'bloqueado' ? 'ativo' : 'bloqueado' }); }} className={sel.estado === 'bloqueado' ? 'text-emerald-600' : 'text-red-500'}>
              {sel.estado === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" icon="mail">Enviar email</Button>
          </>}>
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={sel.nome} color={sel.avatar} size={56} />
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{sel.nome}</h3>
              <Badge tone={ESTADO_CLI[sel.estado].tone} dot>{ESTADO_CLI[sel.estado].t}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              [isLoja ? 'Encomendas' : 'Visitas', sel.visitas, 'box'],
              ['Total gasto', fmtEur(sel.gasto), 'euro'],
              ['Ticket médio', fmtEur(Math.round(sel.gasto / sel.visitas)), 'trend'],
              ['Última', sel.ultima.slice(5), 'clock'],
            ].map(([k, v, ic]) => (
              <div key={k} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                <Icon name={ic} className="w-4 h-4 text-zinc-400 mb-1.5" />
                <p className="font-semibold text-zinc-900 dark:text-white tabular-nums">{v}</p>
                <p className="text-xs text-zinc-400">{k}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300"><Icon name="mail" className="w-4 h-4 text-zinc-400" />{sel.email}</div>
            <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300"><Icon name="phone" className="w-4 h-4 text-zinc-400" />{sel.telefone}</div>
          </div>
          <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">{isLoja ? 'Encomendas recentes' : 'Visitas recentes'}</h4>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Icon name={isLoja ? 'cart' : 'scissors'} className="w-4 h-4" /></span>
                  <div className="flex-1"><p className="text-zinc-800 dark:text-zinc-100">{isLoja ? `Encomenda #10${40 - i}` : `${['Corte + Barba', 'Corte', 'Barba'][i]}`}</p><p className="text-xs text-zinc-400">{['há 3 dias', 'há 2 semanas', 'há 1 mês'][i]}</p></div>
                  <span className="font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">{fmtEur([48, 18, 8][i])}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export { Clientes };
