import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Button, IconButton, Badge, Input, Select, Modal, PageHeader, EmptyState, ImgPlaceholder, BADGE_TONES } from './ui.jsx';
import { fmtEur, PRODUTOS_SEED, ENCOMENDAS_SEED } from './data.js';

// ----------------------------------------------------------------------------
// Loja — products (image, stock, price), and orders. Fully interactive.
// ----------------------------------------------------------------------------
const { useState: useStateLoja, useMemo: useMemoLoja } = React;

const ESTADO_ENC = {
  a_preparar: { t: 'A preparar', tone: 'amber' },
  enviada: { t: 'Enviada', tone: 'blue' },
  entregue: { t: 'Entregue', tone: 'green' },
  cancelada: { t: 'Cancelada', tone: 'red' },
};

function ProdutoCard({ p, onEdit }) {
  const low = p.stock > 0 && p.stock <= 8;
  return (
    <Card className="overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="relative">
        <ImgPlaceholder label={p.categoria} tint={p.cor} rounded="rounded-none" className="h-36" />
        <div className="absolute top-2.5 right-2.5">
          {p.stock === 0 ? <Badge tone="red" dot>Esgotado</Badge> : low ? <Badge tone="amber" dot>Stock baixo</Badge> : <Badge tone="green" dot>Em stock</Badge>}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-white text-sm truncate">{p.nome}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{p.sku} · {p.categoria}</p>
          </div>
          <IconButton icon="edit" label="Editar" onClick={() => onEdit(p)} className="-mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition" />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">{fmtEur(p.preco)}</span>
          <span className="text-[13px] text-zinc-500 tabular-nums">{p.stock} un.</span>
        </div>
      </div>
    </Card>
  );
}

function ProdutoModal({ open, produto, onClose, onSave }) {
  const [form, setForm] = useStateLoja({ nome: '', categoria: 'Cabelo', preco: '', stock: '', sku: '', cor: '#2A6FDB' });
  React.useEffect(() => { if (open) setForm(produto || { nome: '', categoria: 'Cabelo', preco: '', stock: '', sku: '', cor: '#2A6FDB' }); }, [open, produto]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title={produto ? 'Editar produto' : 'Novo produto'} subtitle="Preenche os detalhes do produto."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" onClick={() => onSave(form)}>{produto ? 'Guardar' : 'Adicionar'}</Button></>}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <ImgPlaceholder label="foto" tint={form.cor} className="h-28" />
            <button className="mt-2 w-full text-xs text-accent font-medium flex items-center justify-center gap-1 hover:underline"><Icon name="image" className="w-3.5 h-3.5" />Carregar</button>
          </div>
          <div className="flex-1 space-y-3">
            <Input label="Nome do produto" placeholder="Ex: Pomada Modeladora" value={form.nome} onChange={set('nome')} />
            <Input label="SKU / Referência" placeholder="PM-001" value={form.sku} onChange={set('sku')} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Select label="Categoria" value={form.categoria} onChange={set('categoria')}>
            {['Cabelo', 'Barba', 'Acessórios', 'Kits'].map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Preço (€)" type="number" placeholder="14.90" value={form.preco} onChange={set('preco')} />
          <Input label="Stock" type="number" placeholder="0" value={form.stock} onChange={set('stock')} />
        </div>
      </div>
    </Modal>
  );
}

function Loja() {
  const [tab, setTab] = useStateLoja('produtos');
  const [produtos, setProdutos] = useStateLoja(PRODUTOS_SEED);
  const [q, setQ] = useStateLoja('');
  const [cat, setCat] = useStateLoja('Todas');
  const [modal, setModal] = useStateLoja(false);
  const [editing, setEditing] = useStateLoja(null);

  const filtered = useMemoLoja(() => produtos.filter((p) =>
    (cat === 'Todas' || p.categoria === cat) && p.nome.toLowerCase().includes(q.toLowerCase())
  ), [produtos, q, cat]);

  const stats = useMemoLoja(() => ({
    total: produtos.length,
    stock: produtos.reduce((s, p) => s + p.stock, 0),
    baixo: produtos.filter((p) => p.stock > 0 && p.stock <= 8).length,
    esgotado: produtos.filter((p) => p.stock === 0).length,
  }), [produtos]);

  const save = (form) => {
    const norm = { ...form, preco: parseFloat(form.preco) || 0, stock: parseInt(form.stock) || 0, estado: (parseInt(form.stock) || 0) === 0 ? 'esgotado' : 'ativo' };
    if (editing) setProdutos(produtos.map((p) => (p.id === editing.id ? { ...p, ...norm } : p)));
    else setProdutos([{ ...norm, id: 'p' + Date.now() }, ...produtos]);
    setModal(false); setEditing(null);
  };

  return (
    <div>
      <PageHeader title="Loja" subtitle="Gere produtos, stock e encomendas da tua loja online.">
        <Button icon="plus" onClick={() => { setEditing(null); setModal(true); }}>Novo produto</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: 'Produtos', v: stats.total, i: 'box', tone: 'blue' },
          { l: 'Unidades em stock', v: stats.stock, i: 'package', tone: 'green' },
          { l: 'Stock baixo', v: stats.baixo, i: 'trend', tone: 'amber' },
          { l: 'Esgotados', v: stats.esgotado, i: 'ban', tone: 'red' },
        ].map((s) => (
          <Card key={s.l} className="p-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[s.tone]}`}><Icon name={s.i} className="w-5 h-5" /></span>
            <div><p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{s.v}</p><p className="text-[13px] text-zinc-500">{s.l}</p></div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-5">
        {[['produtos', 'Produtos'], ['encomendas', 'Encomendas']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === id ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>{label}</button>
        ))}
      </div>

      {tab === 'produtos' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar produto…" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm pl-10 pr-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Todas', 'Cabelo', 'Barba', 'Acessórios', 'Kits'].map((c) => (
                <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition ${cat === c ? 'bg-accent text-white border-accent' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{c}</button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((p) => <ProdutoCard key={p.id} p={p} onEdit={(prod) => { setEditing(prod); setModal(true); }} />)}
            </div>
          ) : <Card><EmptyState icon="search" title="Sem produtos" desc="Não há produtos que correspondam à pesquisa." /></Card>}
        </div>
      )}

      {tab === 'encomendas' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                  <th className="font-medium px-4 sm:px-5 py-3">Encomenda</th>
                  <th className="font-medium px-4 py-3">Cliente</th>
                  <th className="font-medium px-4 py-3 hidden sm:table-cell">Itens</th>
                  <th className="font-medium px-4 py-3">Total</th>
                  <th className="font-medium px-4 py-3">Estado</th>
                  <th className="font-medium px-4 py-3 hidden md:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {ENCOMENDAS_SEED.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                    <td className="px-4 sm:px-5 py-3.5 font-medium text-zinc-900 dark:text-white tabular-nums">{o.id}</td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-300">{o.cliente}</td>
                    <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell tabular-nums">{o.itens}</td>
                    <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white tabular-nums">{fmtEur(o.total)}</td>
                    <td className="px-4 py-3.5"><Badge tone={ESTADO_ENC[o.estado].tone} dot>{ESTADO_ENC[o.estado].t}</Badge></td>
                    <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell">{o.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProdutoModal open={modal} produto={editing} onClose={() => { setModal(false); setEditing(null); }} onSave={save} />
    </div>
  );
}

export { Loja };
