import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Button, IconButton, Badge, Input, Select, Toggle, Modal, PageHeader, BADGE_TONES } from './ui.jsx';
import { COMPONENTES } from './data.js';

// ----------------------------------------------------------------------------
// Admin — manage tenant accounts, permissions (roles) and components.
// This drives the live permission system used across the app.
// ----------------------------------------------------------------------------
const { useState: useStateAdm } = React;

const TIPO_CONTA = { barbearia: { t: 'Barbearia', tone: 'blue', icon: 'scissors' }, loja: { t: 'Loja', tone: 'green', icon: 'store' }, admin: { t: 'Plataforma', tone: 'violet', icon: 'shield' } };
const CORES_PERM = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4'];
const ICONES_DISP = ['grid', 'box', 'store', 'calendar', 'users', 'shield', 'cart', 'scissors', 'euro', 'package', 'layers', 'star', 'clock', 'image', 'settings', 'dashboard'];
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ---- Component editor (create a platform component, with DB key) -----------
function ComponenteModal({ open, componente, onClose, onSave }) {
  const [form, setForm] = useStateAdm({ nome: '', chave: '', desc: '', icon: 'grid' });
  const [tocouChave, setTocouChave] = useStateAdm(false);
  React.useEffect(() => { if (open) { setForm(componente || { nome: '', chave: '', desc: '', icon: 'grid' }); setTocouChave(!!componente); } }, [open, componente]);
  return (
    <Modal open={open} onClose={onClose} width="max-w-md" title={componente ? 'Editar componente' : 'Novo componente'} subtitle="Um módulo da plataforma que pode ser atribuído a permissões."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.nome || !form.chave}>{componente ? 'Guardar' : 'Criar componente'}</Button></>}>
      <div className="space-y-4">
        <Input label="Nome (apresentação)" placeholder="Ex: Fidelização" value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value, chave: tocouChave ? f.chave : slugify(e.target.value) }))} />
        <Input label="Nome na BD (chave enviada)" icon="layers" placeholder="ex: fidelizacao" value={form.chave}
          onChange={(e) => { setTocouChave(true); setForm((f) => ({ ...f, chave: slugify(e.target.value) })); }}
          hint="Identificador técnico único — é este o valor guardado/enviado para a base de dados." />
        <Input label="Descrição" placeholder="O que este componente faz" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        <div>
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Ícone</span>
          <div className="grid grid-cols-8 gap-1.5">
            {ICONES_DISP.map((ic) => (
              <button key={ic} onClick={() => setForm({ ...form, icon: ic })} className={`aspect-square rounded-lg flex items-center justify-center transition ${form.icon === ic ? 'bg-accent text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><Icon name={ic} className="w-[18px] h-[18px]" /></button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Permission editor (create / edit a role + its components) --------------
function PermissaoModal({ open, permissao, componentes, onClose, onSave }) {
  const [form, setForm] = useStateAdm({ nome: '', descricao: '', cor: CORES_PERM[0], componentes: ['dashboard'] });
  React.useEffect(() => { if (open) setForm(permissao || { nome: '', descricao: '', cor: CORES_PERM[0], componentes: ['dashboard'] }); }, [open, permissao]);
  const toggle = (id) => setForm((f) => ({ ...f, componentes: f.componentes.includes(id) ? f.componentes.filter((x) => x !== id) : [...f.componentes, id] }));

  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title={permissao ? 'Editar permissão' : 'Nova permissão'} subtitle="Define que componentes esta permissão pode aceder."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.nome}>{permissao ? 'Guardar' : 'Criar permissão'}</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Input label="Nome da permissão" placeholder="Ex: Barbeiro Sénior" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Cor</span>
            <div className="flex gap-1.5">
              {CORES_PERM.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, cor: c })} className={`w-7 h-7 rounded-full transition ${form.cor === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c, boxShadow: form.cor === c ? `0 0 0 2px ${c}` : 'none' }} />
              ))}
            </div>
          </div>
        </div>
        <Input label="Descrição" placeholder="Resumo do que esta permissão faz" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        <div>
          <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Componentes com acesso</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {componentes.map((c) => {
              const on = form.componentes.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${on ? 'border-accent bg-accent/[0.04]' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-accent text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}><Icon name={c.icon} className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{c.nome}</p><p className="text-xs text-zinc-400 truncate">{c.desc}</p></div>
                  <Toggle checked={on} onChange={() => toggle(c.id)} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Account editor --------------------------------------------------------
function ContaModal({ open, conta, permissoes, onClose, onSave }) {
  const [form, setForm] = useStateAdm({ negocio: '', responsavel: '', email: '', tipo: 'barbearia', permissao: 'barbeiro', estado: 'ativo' });
  React.useEffect(() => { if (open) setForm(conta || { negocio: '', responsavel: '', email: '', tipo: 'barbearia', permissao: permissoes[0]?.id, estado: 'ativo' }); }, [open, conta]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title={conta ? 'Editar conta' : 'Criar conta de cliente'} subtitle="Estes são os negócios que usam a plataforma."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)} disabled={!form.negocio}>{conta ? 'Guardar' : 'Criar conta'}</Button></>}>
      <div className="space-y-4">
        <Input label="Nome do negócio" placeholder="Ex: Barbearia Navalha" value={form.negocio} onChange={set('negocio')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Responsável" placeholder="Nome" value={form.responsavel} onChange={set('responsavel')} />
          <Input label="Email" type="email" placeholder="email@negocio.pt" value={form.email} onChange={set('email')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Tipo de negócio" value={form.tipo} onChange={set('tipo')}>
            <option value="barbearia">Barbearia</option>
            <option value="loja">Loja</option>
          </Select>
          <Select label="Permissão" value={form.permissao} onChange={set('permissao')}>
            {permissoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Conta ativa</p><p className="text-xs text-zinc-400">Desativa para suspender o acesso.</p></div>
          <Toggle checked={form.estado === 'ativo'} onChange={(v) => setForm({ ...form, estado: v ? 'ativo' : 'suspenso' })} />
        </div>
      </div>
    </Modal>
  );
}

function Admin({ contas, setContas, permissoes, setPermissoes, componentes, setComponentes }) {
  const [tab, setTab] = useStateAdm('contas');
  const [contaModal, setContaModal] = useStateAdm(false);
  const [permModal, setPermModal] = useStateAdm(false);
  const [compModal, setCompModal] = useStateAdm(false);
  const [editConta, setEditConta] = useStateAdm(null);
  const [editPerm, setEditPerm] = useStateAdm(null);
  const [editComp, setEditComp] = useStateAdm(null);

  const nomePerm = (id) => permissoes.find((p) => p.id === id)?.nome || '—';

  const saveConta = (form) => {
    if (editConta) setContas(contas.map((c) => (c.id === editConta.id ? { ...c, ...form } : c)));
    else setContas([...contas, { ...form, id: 'c' + Date.now(), desde: '2026-06-03' }]);
    setContaModal(false); setEditConta(null);
  };
  const savePerm = (form) => {
    if (editPerm) setPermissoes(permissoes.map((p) => (p.id === editPerm.id ? { ...p, ...form } : p)));
    else setPermissoes([...permissoes, { ...form, id: 'perm' + Date.now() }]);
    setPermModal(false); setEditPerm(null);
  };
  const delPerm = (id) => setPermissoes(permissoes.filter((p) => p.id !== id));

  const saveComp = (form) => {
    if (editComp) setComponentes(componentes.map((c) => (c.id === editComp.id ? { ...c, ...form, desc: form.desc } : c)));
    else { const id = form.chave; setComponentes([...componentes, { id, nome: form.nome, chave: form.chave, desc: form.desc, icon: form.icon }]); }
    setCompModal(false); setEditComp(null);
  };
  const delComp = (id) => { setComponentes(componentes.filter((c) => c.id !== id)); setPermissoes(permissoes.map((p) => ({ ...p, componentes: p.componentes.filter((x) => x !== id) }))); };

  return (
    <div>
      <PageHeader title="Admin" subtitle="Gere contas de clientes, permissões e componentes da plataforma." />

      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {[['contas', 'Contas de clientes'], ['permissoes', 'Permissões'], ['componentes', 'Componentes']].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${tab === id ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>{l}</button>
        ))}
      </div>

      {/* CONTAS */}
      {tab === 'contas' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-zinc-500">{contas.length} contas registadas</p>
            <Button icon="plus" size="sm" onClick={() => { setEditConta(null); setContaModal(true); }}>Criar conta</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="font-medium px-4 sm:px-5 py-3">Negócio</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">Responsável</th>
                  <th className="font-medium px-4 py-3">Tipo</th>
                  <th className="font-medium px-4 py-3">Permissão</th>
                  <th className="font-medium px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {contas.map((c) => {
                    const tc = TIPO_CONTA[c.tipo];
                    return (
                      <tr key={c.id} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                        <td className="px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[tc.tone]}`}><Icon name={tc.icon} className="w-[18px] h-[18px]" /></span>
                            <div><p className="font-medium text-zinc-900 dark:text-white">{c.negocio}</p><p className="text-xs text-zinc-400 md:hidden">{c.responsavel}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell"><p className="text-zinc-700 dark:text-zinc-200">{c.responsavel}</p><p className="text-xs text-zinc-400">{c.email}</p></td>
                        <td className="px-4 py-3"><Badge tone={tc.tone}>{tc.t}</Badge></td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{nomePerm(c.permissao)}</td>
                        <td className="px-4 py-3"><Badge tone={c.estado === 'ativo' ? 'green' : 'amber'} dot>{c.estado === 'ativo' ? 'Ativo' : 'Suspenso'}</Badge></td>
                        <td className="px-4 py-3 text-right"><IconButton icon="edit" label="Editar" onClick={() => { setEditConta(c); setContaModal(true); }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PERMISSOES */}
      {tab === 'permissoes' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-zinc-500">Cada permissão dá acesso a um conjunto de componentes. Cria a permissão "Barbeiro" e escolhe os componentes.</p>
            <Button icon="plus" size="sm" onClick={() => { setEditPerm(null); setPermModal(true); }} className="shrink-0">Nova permissão</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {permissoes.map((p) => (
              <Card key={p.id} className="p-5 group">
                <div className="flex items-start justify-between">
                  <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: p.cor }}><Icon name="shield" className="w-5 h-5" /></span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <IconButton icon="edit" label="Editar" onClick={() => { setEditPerm(p); setPermModal(true); }} />
                    {p.id !== 'super' && <IconButton icon="trash" label="Eliminar" onClick={() => delPerm(p.id)} className="hover:text-red-500" />}
                  </div>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mt-3">{p.nome}</h3>
                <p className="text-[13px] text-zinc-500 mt-0.5 min-h-[20px]">{p.descricao}</p>
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
                  {p.componentes.map((cid) => {
                    const comp = componentes.find((c) => c.id === cid);
                    if (!comp) return null;
                    return <span key={cid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"><Icon name={comp.icon} className="w-3 h-3" />{comp.nome}</span>;
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* COMPONENTES */}
      {tab === 'componentes' && (
        <div>
          <div className="flex justify-between items-center gap-3 mb-4">
            <p className="text-sm text-zinc-500">Os componentes da plataforma. Cada um tem um <span className="font-medium text-zinc-700 dark:text-zinc-200">nome na BD</span> (a chave enviada).</p>
            <Button icon="plus" size="sm" className="shrink-0" onClick={() => { setEditComp(null); setCompModal(true); }}>Novo componente</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {componentes.map((c) => {
              const usos = permissoes.filter((p) => p.componentes.includes(c.id)).length;
              const core = ['dashboard', 'clientes', 'loja', 'agenda', 'admin'].includes(c.id);
              return (
                <Card key={c.id} className="p-5 group">
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name={c.icon} className="w-5 h-5" /></span>
                    <div className="min-w-0 flex-1"><h3 className="font-semibold text-zinc-900 dark:text-white">{c.nome}</h3><p className="text-xs text-zinc-400 truncate">{c.desc}</p></div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <IconButton icon="edit" label="Editar" onClick={() => { setEditComp(c); setCompModal(true); }} />
                      {!core && <IconButton icon="trash" label="Eliminar" onClick={() => delComp(c.id)} className="hover:text-red-500" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{c.chave || c.id}</span>
                    {core && <Badge tone="blue">Core</Badge>}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800 text-[13px]">
                    <span className="text-zinc-500">Usado em <span className="font-medium text-zinc-800 dark:text-zinc-100">{usos}</span> permissões</span>
                    <Badge tone="green" dot>Ativo</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <ContaModal open={contaModal} conta={editConta} permissoes={permissoes} onClose={() => { setContaModal(false); setEditConta(null); }} onSave={saveConta} />
      <PermissaoModal open={permModal} permissao={editPerm} componentes={componentes} onClose={() => { setPermModal(false); setEditPerm(null); }} onSave={savePerm} />
      <ComponenteModal open={compModal} componente={editComp} onClose={() => { setCompModal(false); setEditComp(null); }} onSave={saveComp} />
    </div>
  );
}

export { Admin };
