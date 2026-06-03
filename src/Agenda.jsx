import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Button, IconButton, Badge, Avatar, Modal, PageHeader } from './ui.jsx';
import { fmtEur, DIAS, SERVICOS, MARCACOES_SEED } from './data.js';
import { AG_H_START, AG_H_END, AG_ROW_H, agHora, agBloqueioDoDia, agSlotsDia, TIPO_BLOQUEIO, NovaMarcacaoModal, ServicoModal, HorarioPanel, FeriasPanel } from './AgendaPanels.jsx';

// ----------------------------------------------------------------------------
// Agenda — calendar + sub-navigation (Calendário / Horário & Pausas / Férias)
// Constants, modals & panels come from AgendaPanels.jsx (loaded first)
// ----------------------------------------------------------------------------
const { useState: useStateAg, useMemo: useMemoAg } = React;

function ESTADO_MARC(e) {
  return e === 'confirmada' ? { tone: 'green', t: 'Confirmada' } : e === 'pendente' ? { tone: 'amber', t: 'Pendente' } : { tone: 'red', t: 'Cancelada' };
}

function Agenda() {
  const [vista, setVista] = useStateAg('cal');
  const [servicos, setServicos] = useStateAg(SERVICOS);
  const [marcacoes, setMarcacoes] = useStateAg(MARCACOES_SEED);
  const [bloqueados, setBloqueados] = useStateAg(['Tiago Lopes']);
  const [diasConfig, setDiasConfig] = useStateAg([
    { aberto: true, ini: 9, fim: 19, almoco: { ativo: true, ini: 13, fim: 14 } },
    { aberto: true, ini: 9, fim: 19, almoco: { ativo: true, ini: 13, fim: 14 } },
    { aberto: true, ini: 9, fim: 19, almoco: { ativo: true, ini: 13, fim: 14 } },
    { aberto: true, ini: 9, fim: 19, almoco: { ativo: true, ini: 13, fim: 14 } },
    { aberto: true, ini: 9, fim: 19, almoco: { ativo: true, ini: 13, fim: 14 } },
    { aberto: true, ini: 9, fim: 14, almoco: { ativo: false, ini: 13, fim: 14 } },
  ]);
  const [bloqueios, setBloqueios] = useStateAg([
    { id: 'b1', tipo: 'feriado', de: '2026-06-02', ate: '2026-06-02', motivo: 'Feriado municipal' },
    { id: 'b2', tipo: 'ferias', de: '2026-06-23', ate: '2026-06-30', motivo: 'Férias de verão' },
  ]);
  const [sel, setSel] = useStateAg(null);
  const [novaOpen, setNovaOpen] = useStateAg(false);
  const [novaPreset, setNovaPreset] = useStateAg(null);
  const [servModal, setServModal] = useStateAg(false);
  const [editServ, setEditServ] = useStateAg(null);

  const abrirNova = (preset) => { setNovaPreset(preset || null); setNovaOpen(true); };

  const horas = useMemoAg(() => Array.from({ length: AG_H_END - AG_H_START }, (_, i) => AG_H_START + i), []);
  const serv = (id) => servicos.find((s) => s.id === id) || servicos[0];

  const cancelar = (id) => { setMarcacoes(marcacoes.map((m) => (m.id === id ? { ...m, estado: 'cancelada' } : m))); setSel(null); };
  const confirmar = (id) => { setMarcacoes(marcacoes.map((m) => (m.id === id ? { ...m, estado: 'confirmada' } : m))); setSel(null); };
  const toggleBloqueio = (cli) => setBloqueados((b) => (b.includes(cli) ? b.filter((x) => x !== cli) : [...b, cli]));
  const addMarcacao = (form) => { setMarcacoes([...marcacoes, { ...form, dia: +form.dia, inicio: +form.inicio, id: 'm' + Date.now() }]); setNovaOpen(false); };
  const saveServico = (form) => {
    const norm = { ...form, preco: parseFloat(form.preco) || 0, dur: +form.dur };
    if (editServ) setServicos(servicos.map((s) => (s.id === editServ.id ? { ...s, ...norm } : s)));
    else setServicos([...servicos, { ...norm, id: 's' + Date.now() }]);
    setServModal(false); setEditServ(null);
  };
  const delServico = (id) => { setServicos(servicos.filter((s) => s.id !== id)); setServModal(false); setEditServ(null); };

  const pendentes = marcacoes.filter((m) => m.estado === 'pendente');
  const TABS = [['cal', 'Calendário', 'calendar'], ['horario', 'Horário & Pausas', 'clock'], ['ferias', 'Férias & Bloqueios', 'star']];

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Barbearia Navalha · semana de 1 – 6 Junho 2026">
        {vista === 'cal' && (
          <>
            <div className="flex items-center gap-1">
              <IconButton icon="chevronLeft" label="Anterior" className="border border-zinc-200 dark:border-zinc-700" />
              <Button variant="outline" size="sm">Hoje</Button>
              <IconButton icon="chevronRight" label="Seguinte" className="border border-zinc-200 dark:border-zinc-700" />
            </div>
            <Button icon="plus" size="sm" onClick={() => abrirNova()}>Nova marcação</Button>
          </>
        )}
      </PageHeader>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 mb-6 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl w-full sm:w-auto sm:inline-flex overflow-x-auto">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setVista(id)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${vista === id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            <Icon name={icon} className="w-4 h-4" />{label}
            {id === 'ferias' && bloqueios.length > 0 && <span className="ml-0.5 text-[11px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full px-1.5">{bloqueios.length}</span>}
          </button>
        ))}
      </div>

      {/* HORÁRIO & PAUSAS */}
      {vista === 'horario' && <HorarioPanel diasConfig={diasConfig} setDiasConfig={setDiasConfig} />}

      {/* FÉRIAS & BLOQUEIOS */}
      {vista === 'ferias' && <FeriasPanel bloqueios={bloqueios} setBloqueios={setBloqueios} />}

      {/* CALENDÁRIO */}
      {vista === 'cal' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Day headers */}
                <div className="grid border-b border-zinc-100 dark:border-zinc-800" style={{ gridTemplateColumns: `52px repeat(${DIAS.length}, 1fr)` }}>
                  <div />
                  {DIAS.map((d, i) => {
                    const c = diasConfig[i];
                    const blk = agBloqueioDoDia(bloqueios, i);
                    const fechado = !c.aberto;
                    return (
                      <div key={d} className="px-2 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/50">
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">{d}</p>
                        <p className={`text-lg font-semibold leading-tight ${i === 2 ? 'text-accent' : 'text-zinc-800 dark:text-zinc-100'}`}>{i + 1}</p>
                        {blk ? <Badge tone={TIPO_BLOQUEIO[blk.tipo].tone} className="mt-0.5 scale-90">{TIPO_BLOQUEIO[blk.tipo].t}</Badge>
                          : fechado ? <Badge tone="neutral" className="mt-0.5 scale-90">Fechado</Badge>
                            : <p className="text-[10px] text-zinc-400 tabular-nums">{agHora(c.ini)}–{agHora(c.fim)}</p>}
                      </div>
                    );
                  })}
                </div>
                {/* Grid */}
                <div className="grid relative" style={{ gridTemplateColumns: `52px repeat(${DIAS.length}, 1fr)` }}>
                  <div>
                    {horas.map((h) => (
                      <div key={h} className="text-right pr-2 text-[11px] text-zinc-400 tabular-nums" style={{ height: AG_ROW_H }}><span className="-translate-y-2 inline-block">{agHora(h)}</span></div>
                    ))}
                  </div>
                  {DIAS.map((d, di) => {
                    const c = diasConfig[di];
                    const blk = agBloqueioDoDia(bloqueios, di);
                    const aberto = c.aberto;
                    const alm = c.almoco;
                    return (
                      <div key={d} className="relative border-l border-zinc-50 dark:border-zinc-800/50">
                        {horas.map((h) => {
                          const fora = h < c.ini || h >= c.fim;
                          return <div key={h} className={`border-b border-zinc-50 dark:border-zinc-800/40 ${fora && aberto ? 'bg-zinc-50/60 dark:bg-zinc-800/20' : ''}`} style={{ height: AG_ROW_H }} />;
                        })}
                        {/* Date block = aviso visual apenas (continua a poder marcar) */}
                        {aberto && blk && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ background: 'repeating-linear-gradient(135deg, rgba(113,113,122,.06), rgba(113,113,122,.06) 7px, transparent 7px, transparent 14px)' }}>
                            <span className="text-[11px] font-medium text-zinc-400/80 -rotate-90 whitespace-nowrap tracking-wide">{blk.motivo || TIPO_BLOQUEIO[blk.tipo].t}</span>
                          </div>
                        )}
                        {/* Lunch band */}
                        {aberto && alm.ativo && (
                          <div className="absolute left-0 right-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{ top: (alm.ini - AG_H_START) * AG_ROW_H, height: (alm.fim - alm.ini) * AG_ROW_H, background: 'repeating-linear-gradient(135deg, rgba(230,180,80,.12), rgba(230,180,80,.12) 6px, transparent 6px, transparent 12px)' }}>
                            <span className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80 flex items-center gap-1"><Icon name="clock" className="w-3 h-3" />Almoço</span>
                          </div>
                        )}
                        {/* Clickable empty slots → nova marcação (também em feriado/férias) */}
                        {aberto && agSlotsDia(c).map((s) => (
                          <button key={'slot' + s} onClick={() => abrirNova({ dia: di, inicio: s })} title={`Marcar ${DIAS[di]} ${agHora(s)}`}
                            className="group/slot absolute left-0.5 right-0.5 rounded-md hover:bg-accent/[0.07] transition-colors flex items-start justify-center"
                            style={{ top: (s - AG_H_START) * AG_ROW_H + 1, height: AG_ROW_H / 2 - 2 }}>
                            <Icon name="plus" className="w-3.5 h-3.5 text-accent opacity-0 group-hover/slot:opacity-100 transition-opacity mt-0.5" />
                          </button>
                        ))}
                        {/* Appointments */}
                        {aberto && marcacoes.filter((m) => m.dia === di).map((m) => {
                          const s = serv(m.servico);
                          const top = (m.inicio - AG_H_START) * AG_ROW_H;
                          const height = (s.dur / 60) * AG_ROW_H - 4;
                          const cancel = m.estado === 'cancelada';
                          return (
                            <button key={m.id} onClick={() => setSel(m)} className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden transition hover:shadow-md hover:z-10"
                              style={{ top: top + 2, height, background: cancel ? 'transparent' : `${s.cor}14`, border: `1px solid ${cancel ? '#e4e4e7' : s.cor + '40'}`, borderLeft: `3px solid ${cancel ? '#a1a1aa' : s.cor}` }}>
                              <p className={`text-[11px] font-semibold leading-tight truncate ${cancel ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{s.nome}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{m.cliente}</p>
                              {m.estado === 'pendente' && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                            </button>
                          );
                        })}
                        {/* Closed weekday (folga) = sem atendimento */}
                        {!aberto && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'repeating-linear-gradient(135deg, rgba(113,113,122,.07), rgba(113,113,122,.07) 7px, transparent 7px, transparent 14px)' }}>
                            <span className="text-[11px] font-medium text-zinc-400 -rotate-90 whitespace-nowrap tracking-wide">Fechado</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2"><Icon name="clock" className="w-4 h-4 text-amber-500" />Por confirmar <Badge tone="amber">{pendentes.length}</Badge></h3>
              <div className="mt-3 space-y-2">
                {pendentes.length ? pendentes.map((m) => {
                  const s = serv(m.servico);
                  return (
                    <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: s.cor }} />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{m.cliente}</p><p className="text-xs text-zinc-400">{DIAS[m.dia]} · {agHora(m.inicio)} · {s.nome}</p></div>
                      <IconButton icon="check" label="Confirmar" onClick={() => confirmar(m.id)} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" />
                    </div>
                  );
                }) : <p className="text-sm text-zinc-400 py-2">Tudo confirmado ✓</p>}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2"><Icon name="ban" className="w-4 h-4 text-red-500" />Clientes bloqueados</h3>
              <div className="mt-3 space-y-1.5">
                {bloqueados.length ? bloqueados.map((cli) => (
                  <div key={cli} className="flex items-center gap-2.5 p-1.5">
                    <Avatar name={cli} color="#71717a" size={30} />
                    <span className="text-sm text-zinc-700 dark:text-zinc-200 flex-1 truncate">{cli}</span>
                    <button onClick={() => toggleBloqueio(cli)} className="text-xs text-accent hover:underline">Desbloquear</button>
                  </div>
                )) : <p className="text-sm text-zinc-400 py-1">Nenhum cliente bloqueado.</p>}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Serviços</h3>
                <Button variant="ghost" size="sm" icon="plus" onClick={() => { setEditServ(null); setServModal(true); }}>Novo</Button>
              </div>
              <div className="space-y-1">
                {servicos.map((s) => (
                  <button key={s.id} onClick={() => { setEditServ(s); setServModal(true); }} className="w-full flex items-center gap-2.5 text-sm p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition text-left group">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                    <span className="text-zinc-700 dark:text-zinc-200 flex-1 truncate">{s.nome}</span>
                    <span className="text-zinc-400 text-xs">{s.dur}min</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-100 tabular-nums w-12 text-right">{fmtEur(s.preco)}</span>
                    <Icon name="edit" className="w-3.5 h-3.5 text-zinc-300 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {sel && (() => {
        const s = serv(sel.servico); const est = ESTADO_MARC(sel.estado); const blocked = bloqueados.includes(sel.cliente);
        return (
          <Modal open onClose={() => setSel(null)} title={s.nome} subtitle={`${DIAS[sel.dia]} ${sel.dia + 1} Jun · ${agHora(sel.inicio)}–${agHora(sel.inicio + s.dur / 60)}`}
            footer={<>
              <Button variant="ghost" onClick={() => toggleBloqueio(sel.cliente)} icon="ban" className={blocked ? 'text-emerald-600' : 'text-red-500'}>{blocked ? 'Desbloquear cliente' : 'Bloquear cliente'}</Button>
              <div className="flex-1" />
              {sel.estado !== 'cancelada' && <Button variant="outline" onClick={() => cancelar(sel.id)}>Cancelar marcação</Button>}
              {sel.estado === 'pendente' && <Button icon="check" onClick={() => confirmar(sel.id)}>Confirmar</Button>}
            </>}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={sel.cliente} color={s.cor} size={44} />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{sel.cliente}</p>
                  <div className="flex items-center gap-2 mt-0.5"><Badge tone={est.tone} dot>{est.t}</Badge>{blocked && <Badge tone="red">Bloqueado</Badge>}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[['Serviço', s.nome], ['Duração', s.dur + ' min'], ['Preço', fmtEur(s.preco)]].map(([k, v]) => (
                  <div key={k} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3"><p className="text-xs text-zinc-400">{k}</p><p className="font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{v}</p></div>
                ))}
              </div>
            </div>
          </Modal>
        );
      })()}

      <NovaMarcacaoModal open={novaOpen} servicos={servicos} diasConfig={diasConfig} bloqueios={bloqueios} preset={novaPreset} onClose={() => setNovaOpen(false)} onSave={addMarcacao} />
      <ServicoModal open={servModal} servico={editServ} onClose={() => { setServModal(false); setEditServ(null); }} onSave={saveServico} onDelete={delServico} />
    </div>
  );
}

export { Agenda };
