import { useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { getApiError } from '../lib/apiError'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, IconButton, Badge, Input, Select, Modal, PageHeader, EmptyState, ImgPlaceholder, BADGE_TONES } from '../ui/ui.jsx'
import { useGetProducts, getProductsQueryKey } from '../gen/backoffice/hooks/useGetProducts.js'
import { usePostProducts } from '../gen/backoffice/hooks/usePostProducts.js'
import { usePutProductsId } from '../gen/backoffice/hooks/usePutProductsId.js'
import { useDeleteProductsId } from '../gen/backoffice/hooks/useDeleteProductsId.js'
import { useGetCategories } from '../gen/backoffice/hooks/useGetCategories.js'
import { useGetOrders, getOrdersQueryKey } from '../gen/backoffice/hooks/useGetOrders.js'
import type { Product } from '../gen/backoffice/types/Product.js'

const UPLOADS = import.meta.env.VITE_UPLOADS_URL as string

const fmtEur = (n: number) =>
  '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function ProdutoCard({ p, onEdit }: { p: Product; onEdit: (p: Product) => void }) {
  const low = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 8
  const firstPhoto = p.photos?.[0]
  return (
    <Card className="overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="relative">
        {firstPhoto
          ? <img src={`${UPLOADS}/${firstPhoto}`} alt={p.name} className="w-full h-36 object-cover" />
          : <ImgPlaceholder label={p.name} tint="#2A6FDB" rounded="rounded-none" className="h-36" />}
        <div className="absolute top-2.5 right-2.5">
          {(p.stock ?? 0) === 0 ? <Badge tone="red" dot>Esgotado</Badge>
            : low ? <Badge tone="amber" dot>Stock baixo</Badge>
              : <Badge tone="green" dot>Em stock</Badge>}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-white text-sm truncate">{p.name}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{p.reference ?? '—'}</p>
          </div>
          <IconButton icon="edit" label="Editar" onClick={() => onEdit(p)} className="-mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition" />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">{fmtEur(Number(p.price))}</span>
          <span className="text-[13px] text-zinc-500 tabular-nums">{p.stock ?? 0} un.</span>
        </div>
      </div>
    </Card>
  )
}

type ProdForm = { name: string; reference: string; price: string; stock: string; description: string; categoryId: string; photo: File | null }
const emptyForm: ProdForm = { name: '', reference: '', price: '', stock: '', description: '', categoryId: '', photo: null }

function ProdutoModal({ open, produto, categories, onClose, onSave, isPending }: {
  open: boolean; produto: Product | null; categories: { categoryId: string; name: string }[]
  onClose: () => void; onSave: (form: ProdForm) => void; isPending: boolean
}) {
  const [form, setForm] = useState<ProdForm>(emptyForm)
  const fileRef = useRef<HTMLInputElement>(null)

  useState(() => {
    if (open) {
      setForm(produto
        ? { name: produto.name, reference: produto.reference ?? '', price: String(produto.price), stock: String(produto.stock ?? 0), description: produto.description ?? '', categoryId: produto.categoryId, photo: null }
        : emptyForm)
    }
  })

  const set = (k: keyof ProdForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal open={open} onClose={onClose} title={produto ? 'Editar produto' : 'Novo produto'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(form)} disabled={isPending}>{isPending ? 'A guardar…' : produto ? 'Guardar' : 'Adicionar'}</Button></>}
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <ImgPlaceholder label="foto" tint="#2A6FDB" className="h-28" />
            <button type="button" className="mt-2 w-full text-xs text-accent font-medium flex items-center justify-center gap-1 hover:underline" onClick={() => fileRef.current?.click()}>
              <Icon name="image" className="w-3.5 h-3.5" />
              {form.photo ? form.photo.name.slice(0, 12) + '…' : 'Carregar'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setForm((f) => ({ ...f, photo: e.target.files?.[0] ?? null }))} />
          </div>
          <div className="flex-1 space-y-3">
            <Input label="Nome do produto" placeholder="Ex: Pomada Modeladora" value={form.name} onChange={set('name')} />
            <Input label="Referência" placeholder="PM-001" value={form.reference} onChange={set('reference')} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Select label="Categoria" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
          </Select>
          <Input label="Preço (€)" type="number" placeholder="14.90" value={form.price} onChange={set('price')} />
          <Input label="Stock" type="number" placeholder="0" value={form.stock} onChange={set('stock')} />
        </div>
        <Input label="Descrição (opcional)" value={form.description} onChange={set('description')} />
      </div>
    </Modal>
  )
}

export function Loja() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const [tab, setTab] = useState<'produtos' | 'encomendas'>('produtos')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { data: productsData, isLoading: loadingProds } = useGetProducts({ client: { headers } })
  const { data: categoriesData } = useGetCategories({ client: { headers } })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders({ client: { headers } })

  const products = productsData?.rows ?? []
  const categories = (categoriesData?.rows ?? []) as { categoryId: string; name: string }[]
  const orders = ordersData?.rows ?? []

  const invalidateProducts = () => qc.invalidateQueries({ queryKey: getProductsQueryKey() })
  const invalidateOrders = () => qc.invalidateQueries({ queryKey: getOrdersQueryKey() })

  const createProduct = usePostProducts({ client: { headers }, mutation: { onSuccess: () => { toast.success('Produto criado'); invalidateProducts() }, onError: (error) => toast.error(getApiError(error)) } })
  const updateProduct = usePutProductsId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Produto actualizado'); invalidateProducts() }, onError: (error) => toast.error(getApiError(error)) } })
  const deleteProduct = useDeleteProductsId({ client: { headers }, mutation: { onSuccess: () => { toast.success('Produto eliminado'); invalidateProducts() }, onError: (error) => toast.error(getApiError(error)) } })

  const filtered = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [products, q])

  const stats = useMemo(() => ({
    total: products.length,
    stock: products.reduce((s, p) => s + (p.stock ?? 0), 0),
    baixo: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 8).length,
    esgotado: products.filter((p) => (p.stock ?? 0) === 0).length,
  }), [products])

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (Number(o.price) || 0), 0), [orders])

  const handleSave = async (form: ProdForm) => {
    const fd = new FormData()
    if (form.name) fd.append('name', form.name)
    if (form.reference) fd.append('reference', form.reference)
    if (form.price) fd.append('price', form.price)
    if (form.stock) fd.append('stock', form.stock)
    if (form.description) fd.append('description', form.description)
    if (form.categoryId) fd.append('categoryId', form.categoryId)
    if (form.photo) fd.append('photos', form.photo)
    if (editing) await updateProduct.mutateAsync({ id: editing.productId, data: fd as any })
    else await createProduct.mutateAsync({ data: fd as any })
    setModal(false)
  }

  return (
    <div>
      <PageHeader title="Loja" subtitle="Gere produtos, stock e encomendas.">
        <Button icon="plus" onClick={() => { setEditing(null); setModal(true) }}>Novo produto</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: 'Produtos', v: stats.total, i: 'box', t: 'blue' as const },
          { l: 'Em stock', v: stats.stock, i: 'package', t: 'green' as const },
          { l: 'Stock baixo', v: stats.baixo, i: 'trend', t: 'amber' as const },
          { l: 'Esgotados', v: stats.esgotado, i: 'ban', t: 'red' as const },
        ].map((s) => (
          <Card key={s.l} className="p-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[s.t]}`}><Icon name={s.i} className="w-5 h-5" /></span>
            <div><p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{s.v}</p><p className="text-[13px] text-zinc-500">{s.l}</p></div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-5">
        {(['produtos', 'encomendas'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === id ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
            {id === 'produtos' ? 'Produtos' : 'Encomendas'}
          </button>
        ))}
      </div>

      {tab === 'produtos' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar produto…" className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm pl-10 pr-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100" />
            </div>
          </div>
          {loadingProds ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-36 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="p-4 space-y-2"><div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" /><div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" /></div>
                </Card>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <div key={p.productId} className="relative group/wrap">
                  <ProdutoCard p={p} onEdit={(prod) => { setEditing(prod); setModal(true) }} />
                  <button onClick={() => confirm(`Eliminar "${p.name}"?`) && deleteProduct.mutate({ id: p.productId })} className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/wrap:opacity-100 transition" title="Eliminar">
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Card><EmptyState icon="search" title="Sem produtos" desc="Não há produtos que correspondam à pesquisa." /></Card>
          )}
        </div>
      )}

      {tab === 'encomendas' && (
        <div>
          <Card className="p-4 mb-4 flex items-center gap-3 w-fit">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${BADGE_TONES.green}`}><Icon name="euro" className="w-5 h-5" /></span>
            <div><p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(totalRevenue)}</p><p className="text-[13px] text-zinc-500">Total faturado</p></div>
          </Card>
          <Card className="overflow-hidden">
            {loadingOrders ? (
              <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="font-medium px-4 sm:px-5 py-3">ID</th>
                      <th className="font-medium px-4 py-3">Total</th>
                      <th className="font-medium px-4 py-3 hidden md:table-cell">Data</th>
                      {/* TODO: status quando o campo for adicionado ao tipo Order no spec da API */}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400">Nenhuma encomenda encontrada.</td></tr>}
                    {orders.map((o) => (
                      <tr key={o.orderId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                        <td className="px-4 sm:px-5 py-3.5 font-mono text-xs text-zinc-500">{o.orderId.slice(0, 8)}…</td>
                        <td className="px-4 py-3.5 font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(Number(o.price))}</td>
                        <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-PT') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <ProdutoModal open={modal} produto={editing} categories={categories} onClose={() => { setModal(false); setEditing(null) }} onSave={handleSave} isPending={createProduct.isPending || updateProduct.isPending} />
    </div>
  )
}
