import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Button, IconButton, Badge, Input, Select, Toggle, Modal, EmptyState, BADGE_TONES } from './ui.jsx';
import { fmtEur, DIAS } from './data.js';

// ----------------------------------------------------------------------------
// Agenda — shared constants, booking & service modals, settings panels
// (loaded before Agenda.jsx)
// ----------------------------------------------------------------------------
const { useState: useStateAP } = React;

const AG_H_START = 8, AG_H_END = 20, AG_ROW_H = 52;
const agHora = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const AG_SLOTS = Array.from({ length: (AG_H_END - AG_H_START) * 2 }, (_, i) => AG_H_START + i / 2);
// Visible week = Mon 1 → Sat 6 June 2026 (index = column)
const AG_DATAS = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06'];
const AG_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const agData = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${AG_MESES[+m - 1]}`; };
const TIPO_BLOQUEIO = {
  ferias: { t: 'Férias', tone: 'violet', icon: 'star' },
  feriado: { t: 'Feriado', tone: 'red', icon: 'calendar' },
  pontual: { t: 'Bloqueio', tone: 'amber', icon: 'ban' },
};

// Is column `di` covered by a date block? returns the block or null
function agBloqueioDoDia(bloqueios, di) {
  const date = AG_DATAS[di];
  return bloqueios.find((b) => b.de <= date && date <= b.ate) || null;
}
// available start slots for a day config (respects open hours + lunch)
function agSlotsDia(cfg) {
  return AG_SLOTS.filter((s) => s >= cfg.ini && s < cfg.fim && !(cfg.almoco && cfg.almoco.ativo && s >= cfg.almoco.ini && s < cfg.almoco.fim));
}

// ---- Nova marcação ----------------------------------------------------------
function NovaMarcacaoModal({ open, servicos, diasConfig, bloqueios, preset, onClose, onSave }) {
  const diasAbertos = diasConfig.map((c, i) => ({ i, ...c })).filter((c) => c.aberto);
  const blkDe = (i) => agBloqueioDoDia(bloqueios, i);
  const init = () => {
    const d = (preset && preset.dia != null) ? preset.dia : (diasAbertos[0]?.i ?? 0);
    const sl = agSlotsDia(diasConfig[d] || { ini: 9, fim: 19 });
    const inicio = (preset && preset.inicio != null && sl.includes(preset.inicio)) ? preset.inicio : (sl[0] ?? 9);
    return { cliente: '', servico: servicos[0]?.id, dia: d, inicio, estado: 'confirmada' };
  };
  const [form, setForm] = useStateAP(init);
  React.useEffect(() => { if (open) setForm(init()); }, [open, preset]);
  const cfg = diasConfig[form.dia] || { ini: 8, fim: 20 };
  const slots = agSlotsDia(cfg);
  return (
    <Modal open={open} onClose={onClose} width="max-w-md" title="Nova marcação" subtitle="Agenda um novo cliente."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.cliente}>Marcar</Button></>}>
      <div className="space-y-4">
        <Input label="Nome do cliente (na BD)" icon="user" placeholder="Ex: João Mendes" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} hint="Este é o nome guardado/enviado para a base de dados." />
        <Select label="Serviço" value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })}>
          {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} · {s.dur}min · {fmtEur(s.preco)}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Dia" value={form.dia} onChange={(e) => { const d = +e.target.value; setForm({ ...form, dia: d, inicio: agSlotsDia(diasConfig[d])[0] }); }}>
            {diasAbertos.map((c) => <option key={c.i} value={c.i}>{DIAS[c.i]} {c.i + 1} Jun{blkDe(c.i) ? ` · ${TIPO_BLOQUEIO[blkDe(c.i).tipo].t}` : ''}</option>)}
          </Select>
          <Select label="Hora" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: +e.target.value })}>
            {slots.map((s) => <option key={s} value={s}>{agHora(s)}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-sm">
          <Toggle checked={form.estado === 'confirmada'} onChange={(v) => setForm({ ...form, estado: v ? 'confirmada' : 'pendente' })} size="sm" />
          <span className="text-zinc-600 dark:text-zinc-300">{form.estado === 'confirmada' ? 'Confirmada' : 'Por confirmar'}</span>
        </div>
        {blkDe(form.dia) && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-[13px] text-amber-700 dark:text-amber-300">
            <Icon name="bell" className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Este dia está marcado como <strong>{TIPO_BLOQUEIO[blkDe(form.dia).tipo].t.toLowerCase()}</strong>. Podes marcar na mesma — a marcação será criada normalmente.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---- Criar / editar serviço -------------------------------------------------
function ServicoModal({ open, servico, onClose, onSave, onDelete }) {
  const CORES = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4'];
  const [form, setForm] = useStateAP({ nome: '', dur: 30, preco: '', cor: CORES[0] });
  React.useEffect(() => { if (open) setForm(servico || { nome: '', dur: 30, preco: '', cor: CORES[0] }); }, [open, servico]);
  return (
    <Modal open={open} onClose={onClose} width="max-w-md" title={servico ? 'Editar serviço' : 'Novo serviço'} subtitle="Nome e duração de cada serviço."
      footer={<>{servico && <Button variant="ghost" className="text-red-500" icon="trash" onClick={() => onDelete(servico.id)}>Eliminar</Button>}<div className="flex-1" /><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.nome}>{servico ? 'Guardar' : 'Criar'}</Button></>}>
      <div className="space-y-4">
        <Input label="Nome do serviço" placeholder="Ex: Corte + Barba" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Duração" value={form.dur} onChange={(e) => setForm({ ...form, dur: +e.target.value })}>
            {[15, 20, 25, 30, 40, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </Select>
          <Input label="Preço (€)" type="number" placeholder="12" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
        </div>
        <div>
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Cor</span>
          <div className="flex gap-1.5">
            {CORES.map((c) => <button key={c} onClick={() => setForm({ ...form, cor: c })} className={`w-7 h-7 rounded-full transition ${form.cor === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c, boxShadow: form.cor === c ? `0 0 0 2px ${c}` : 'none' }} />)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Panel: Horário semanal + pausas (almoço) -------------------------------
function HoraSelect({ value, onChange, max, min, disabled }) {
  return (
    <div className="relative">
      <select value={value} disabled={disabled} onChange={onChange} className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[13px] tabular-nums text-zinc-800 dark:text-zinc-100 pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-40">
        {AG_SLOTS.filter((s) => (max == null || s < max) && (min == null || s > min)).map((s) => <option key={s} value={s}>{agHora(s)}</option>)}
      </select>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"><Icon name="chevronDown" className="w-3.5 h-3.5" /></span>
    </div>
  );
}

function HorarioPanel({ diasConfig, setDiasConfig }) {
  const upd = (i, patch) => setDiasConfig(diasConfig.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const updAlmoco = (i, patch) => setDiasConfig(diasConfig.map((c, idx) => (idx === i ? { ...c, almoco: { ...c.almoco, ...patch } } : c)));
  return (
    <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
      <div className="px-5 py-4">
        <h3 className="font-semibold text-zinc-900 dark:text-white">Horário semanal</h3>
        <p className="text-[13px] text-zinc-500 mt-0.5">Define as horas de abertura e a pausa de almoço de cada dia.</p>
      </div>
      {DIAS.map((d, i) => {
        const c = diasConfig[i];
        return (
          <div key={d} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3 w-full lg:w-44">
              <Toggle checked={c.aberto} onChange={(v) => upd(i, { aberto: v })} />
              <div><p className="font-medium text-sm text-zinc-800 dark:text-zinc-100">{d}, {i + 1} Jun</p><p className="text-xs text-zinc-400">{c.aberto ? 'Aberto' : 'Fechado (folga)'}</p></div>
            </div>
            {c.aberto ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-10">Abre</span>
                  <HoraSelect value={c.ini} max={c.fim} onChange={(e) => upd(i, { ini: +e.target.value })} />
                  <span className="text-zinc-300">–</span>
                  <HoraSelect value={c.fim} min={c.ini} onChange={(e) => upd(i, { fim: +e.target.value })} />
                </div>
                <div className="flex items-center gap-2 lg:ml-auto p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <Icon name="clock" className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-zinc-500 mr-1">Almoço</span>
                  <Toggle checked={c.almoco.ativo} onChange={(v) => updAlmoco(i, { ativo: v })} size="sm" />
                  {c.almoco.ativo && (
                    <div className="flex items-center gap-1.5">
                      <HoraSelect value={c.almoco.ini} max={c.almoco.fim} onChange={(e) => updAlmoco(i, { ini: +e.target.value })} />
                      <span className="text-zinc-300">–</span>
                      <HoraSelect value={c.almoco.fim} min={c.almoco.ini} onChange={(e) => updAlmoco(i, { fim: +e.target.value })} />
                    </div>
                  )}
                </div>
              </>
            ) : <p className="text-sm text-zinc-400">Sem atendimento neste dia.</p>}
          </div>
        );
      })}
    </Card>
  );
}

// ---- Panel: Férias & Bloqueios (by date) ------------------------------------
function BloqueioModal({ open, onClose, onSave }) {
  const [form, setForm] = useStateAP({ tipo: 'ferias', de: '2026-06-23', ate: '2026-06-30', motivo: '' });
  React.useEffect(() => { if (open) setForm({ tipo: 'ferias', de: '2026-06-23', ate: '2026-06-30', motivo: '' }); }, [open]);
  const dateInput = 'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
  return (
    <Modal open={open} onClose={onClose} width="max-w-md" title="Adicionar período" subtitle="Bloqueia datas por férias, feriados ou imprevistos."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.de || !form.ate || form.ate < form.de}>Bloquear</Button></>}>
      <div className="space-y-4">
        <div>
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tipo</span>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIPO_BLOQUEIO).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, tipo: k })} className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition ${form.tipo === k ? 'border-accent bg-accent/[0.04] text-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300'}`}>
                <Icon name={v.icon} className="w-4 h-4" />{v.t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">De</span><input type="date" value={form.de} onChange={(e) => setForm({ ...form, de: e.target.value })} className={dateInput} /></label>
          <label className="block"><span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Até</span><input type="date" value={form.ate} onChange={(e) => setForm({ ...form, ate: e.target.value })} className={dateInput} /></label>
        </div>
        <Input label="Motivo (opcional)" placeholder="Ex: Férias de verão" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
      </div>
    </Modal>
  );
}

function FeriasPanel({ bloqueios, setBloqueios }) {
  const [modal, setModal] = useStateAP(false);
  const add = (form) => { setBloqueios([...bloqueios, { ...form, id: 'b' + Date.now() }].sort((a, b) => a.de.localeCompare(b.de))); setModal(false); };
  const del = (id) => setBloqueios(bloqueios.filter((b) => b.id !== id));
  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div><h3 className="font-semibold text-zinc-900 dark:text-white">Férias & dias bloqueados</h3><p className="text-[13px] text-zinc-500 mt-0.5">Datas em que não há atendimento. Aparecem tracejadas no calendário.</p></div>
        <Button icon="plus" className="sm:ml-auto shrink-0" onClick={() => setModal(true)}>Adicionar período</Button>
      </Card>
      {bloqueios.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bloqueios.map((b) => {
            const t = TIPO_BLOQUEIO[b.tipo];
            const umDia = b.de === b.ate;
            return (
              <Card key={b.id} className="p-4 flex items-center gap-3 group">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[t.tone]}`}><Icon name={t.icon} className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="font-medium text-zinc-900 dark:text-white text-sm">{b.motivo || t.t}</p><Badge tone={t.tone}>{t.t}</Badge></div>
                  <p className="text-xs text-zinc-400 mt-0.5">{umDia ? agData(b.de) : `${agData(b.de)} – ${agData(b.ate)}`}{' '}· {new Date(b.de).getFullYear()}</p>
                </div>
                <IconButton icon="trash" label="Remover" onClick={() => del(b.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500" />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState icon="calendar" title="Sem períodos bloqueados" desc="Adiciona férias, feriados ou um bloqueio pontual." action={<Button icon="plus" onClick={() => setModal(true)}>Adicionar período</Button>} /></Card>
      )}
      <BloqueioModal open={modal} onClose={() => setModal(false)} onSave={add} />
    </div>
  );
}

export { AG_H_START, AG_H_END, AG_ROW_H, agHora, AG_SLOTS, AG_DATAS, agData, TIPO_BLOQUEIO, agBloqueioDoDia, agSlotsDia, NovaMarcacaoModal, ServicoModal, HorarioPanel, FeriasPanel };
