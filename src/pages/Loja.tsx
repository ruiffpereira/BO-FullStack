import { useState, useEffect, useMemo, useRef } from 'react'
import { TranslationInputs, type TranslationMap } from '../components/TranslationInputs'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Button, Badge, Input, Select, Modal, PageHeader, EmptyState, ImgPlaceholder, BADGE_TONES } from '../ui/ui.jsx'
import { useGetProducts, getProductsQueryKey } from '../gen/backoffice/hooks/useGetProducts.js'
import { usePostProducts } from '../gen/backoffice/hooks/usePostProducts.js'
import { usePutProductsId } from '../gen/backoffice/hooks/usePutProductsId.js'
import { useDeleteProductsId } from '../gen/backoffice/hooks/useDeleteProductsId.js'
import { useGetCategories, getCategoriesQueryKey } from '../gen/backoffice/hooks/useGetCategories.js'
import { usePutCategoriesId } from '../gen/backoffice/hooks/usePutCategoriesId.js'
import { useDeleteCategoriesId } from '../gen/backoffice/hooks/useDeleteCategoriesId.js'
import { usePutSubcategoriesId } from '../gen/backoffice/hooks/usePutSubcategoriesId.js'
import { useDeleteSubcategoriesId } from '../gen/backoffice/hooks/useDeleteSubcategoriesId.js'
import { useGetOrders, getOrdersQueryKey } from '../gen/backoffice/hooks/useGetOrders.js'
import type { Product } from '../gen/backoffice/types/Product.js'
import type { ProductImage } from '../gen/backoffice/types/ProductImage.js'
import type { Category } from '../gen/backoffice/types/Category.js'
import type { Subcategory } from '../gen/backoffice/types/Subcategory.js'
import { uploadImage } from '../gen/backoffice/hooks/useUploadImage.js'
import { pickImageFile } from '../lib/filePicker'

const photoUrl = (photo: ProductImage | string | undefined | null) =>
  typeof photo === 'string' ? photo : photo?.fileUrl

const fmtEur = (n: number) =>
  '€' + n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProdutoCard({ p, onEdit, onDelete }: { p: Product; onEdit: () => void; onDelete: () => void }) {
  const low = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 8
  const firstPhoto = photoUrl(p.photos?.[0])
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative"
      onClick={onEdit}
    >
      <div className="relative">
        {firstPhoto
          ? <img src={firstPhoto} alt={p.name} className="w-full h-36 object-cover" />
          : <ImgPlaceholder label={p.name} tint="#2A6FDB" rounded="rounded-none" className="h-36" />}
        <div className="absolute top-2.5 right-2.5">
          {(p.stock ?? 0) === 0
            ? <Badge tone="red" dot>Esgotado</Badge>
            : low ? <Badge tone="amber" dot>Stock baixo</Badge>
            : <Badge tone="green" dot>Em stock</Badge>}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-zinc-900 dark:text-white text-sm truncate">{p.name}</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{p.reference ?? '—'}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">{fmtEur(Number(p.price))}</span>
          <span className="text-[13px] text-zinc-500 tabular-nums">{p.stock ?? 0} un.</span>
        </div>
      </div>
      {/* Delete button — stops propagation so it doesn't open the modal */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        title="Eliminar"
      >
        <Icon name="trash" className="w-3.5 h-3.5" />
      </button>
    </Card>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ProdForm = {
  name: string
  reference: string
  price: string
  stock: string
  description: string
  categoryId: string
  photo: ProductImage | null
  photoName: string
  translations: TranslationMap
}

const emptyForm: ProdForm = {
  name: '', reference: '', price: '', stock: '', description: '', categoryId: '', photo: null, photoName: '', translations: {},
}

function ProdutoModal({ open, produto, categories, onClose, onSave, isPending }: {
  open: boolean
  produto: Product | null
  categories: { categoryId: string; name: string }[]
  onClose: () => void
  onSave: (form: ProdForm) => void
  isPending: boolean
}) {
  const [form, setForm] = useState<ProdForm>(emptyForm)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset form whenever the modal opens or the product changes
  useEffect(() => {
    if (!open) return
    setForm(produto ? {
      name: produto.name ?? '',
      reference: produto.reference ?? '',
      price: String(produto.price ?? ''),
      stock: String(produto.stock ?? 0),
      description: produto.description ?? '',
      categoryId: produto.categoryId ?? '',
      photo: null,
      photoName: '',
      translations: (produto as any).translations ?? {},
    } : emptyForm)
    setPhotoUploading(false)
  }, [open, produto])

  const set = (k: keyof ProdForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const previewSrc = photoUrl(form.photo) ?? photoUrl(produto?.photos?.[0]) ?? null
  const isBusy = isPending || photoUploading

  const handlePhotoChange = async (file: File) => {
    setPhotoUploading(true)
    try {
      const uploaded = await uploadImage({
        image: file,
        module: 'products',
      })
      setForm((f) => ({ ...f, photo: uploaded, photoName: file.name }))
      toast.success('Imagem carregada')
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao carregar imagem')
    } finally {
      setPhotoUploading(false)
    }
  }

  const openPhotoPicker = async () => {
    if (isBusy) return
    try {
      const file = await pickImageFile()
      if (file === undefined) {
        fileRef.current?.click()
        return
      }
      if (file) handlePhotoChange(file)
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Erro ao escolher imagem')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={produto ? 'Editar produto' : 'Novo produto'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={isBusy}>
            {isPending
              ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-middle" />A guardar…</>
              : produto ? 'Guardar' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-lg">
              {previewSrc
                ? <img src={previewSrc} alt="preview" className="h-28 w-28 object-cover" />
                : <ImgPlaceholder label="foto" tint="#2A6FDB" className="h-28" />}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={isBusy}
              className="mt-2 w-full text-xs text-accent font-medium flex items-center justify-center gap-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={openPhotoPicker}
            >
              <Icon name="image" className="w-3.5 h-3.5" />
              {photoUploading ? 'A carregar...' : form.photoName ? `${form.photoName.slice(0, 12)}...` : 'Carregar foto'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isBusy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePhotoChange(file)
                e.target.value = ''
              }}
            />
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
        <TranslationInputs
          value={form.translations}
          onChange={(translations) => setForm((f) => ({ ...f, translations }))}
          fields={['name', 'description']}
          namePlaceholder="Nome do produto traduzido"
          descriptionPlaceholder="Descrição traduzida"
        />
      </div>
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function Loja() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const [tab, setTab] = useState<'produtos' | 'encomendas' | 'categorias'>('produtos')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: productsData, isLoading: loadingProds } = useGetProducts({ client: { headers } })
  const { data: categoriesData } = useGetCategories({ client: { headers } })
  const { data: ordersData, isLoading: loadingOrders } = useGetOrders({ client: { headers } })

  const products = productsData?.rows ?? []
  const categories = (categoriesData?.rows ?? []) as Category[]
  const orders = ordersData?.rows ?? []

  const invalidateProducts = () => qc.invalidateQueries({ queryKey: getProductsQueryKey() })
  const invalidateOrders = () => qc.invalidateQueries({ queryKey: getOrdersQueryKey() })
  const invalidateCats = () => qc.invalidateQueries({ queryKey: getCategoriesQueryKey() })

  // ── Categories state ──
  const [newCatVisible, setNewCatVisible] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null)
  const [newSubCatId, setNewSubCatId] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [editSub, setEditSub] = useState<{ id: string; name: string; categoryId: string } | null>(null)
  const [transModal, setTransModal] = useState<{ id: string; name: string; translations: TranslationMap; type: 'cat' | 'sub'; categoryId?: string } | null>(null)

  const putCategory = usePutCategoriesId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Categoria guardada'); invalidateCats(); setEditCat(null); setNewCatVisible(false); setNewCatName('') },
      onError: () => toast.error('Erro ao guardar categoria'),
    },
  })
  const delCategory = useDeleteCategoriesId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Categoria eliminada'); invalidateCats() },
      onError: () => toast.error('Erro ao eliminar categoria'),
    },
  })
  const putSubcategory = usePutSubcategoriesId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Subcategoria guardada'); invalidateCats(); setEditSub(null); setNewSubCatId(null); setNewSubName('') },
      onError: () => toast.error('Erro ao guardar subcategoria'),
    },
  })
  const delSubcategory = useDeleteSubcategoriesId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Subcategoria eliminada'); invalidateCats() },
      onError: () => toast.error('Erro ao eliminar subcategoria'),
    },
  })

  const saveCat = (id: string | null) => {
    const name = id ? editCat?.name?.trim() : newCatName.trim()
    if (!name) { toast.error('Nome obrigatório'); return }
    putCategory.mutate({ id: id ?? crypto.randomUUID(), data: { name } })
  }
  const saveSub = (id: string | null, categoryId: string) => {
    const name = id ? editSub?.name?.trim() : newSubName.trim()
    if (!name) { toast.error('Nome obrigatório'); return }
    putSubcategory.mutate({ id: id ?? crypto.randomUUID(), data: { name, categoryId } })
  }
  const saveTranslations = () => {
    if (!transModal) return
    if (transModal.type === 'cat') {
      putCategory.mutate(
        { id: transModal.id, data: { name: transModal.name, translations: transModal.translations } as any },
        { onSuccess: () => { toast.success('Traduções guardadas'); setTransModal(null) }, onError: () => toast.error('Erro ao guardar traduções') },
      )
    } else {
      putSubcategory.mutate(
        { id: transModal.id, data: { name: transModal.name, categoryId: transModal.categoryId!, translations: transModal.translations } as any },
        { onSuccess: () => { toast.success('Traduções guardadas'); setTransModal(null) }, onError: () => toast.error('Erro ao guardar traduções') },
      )
    }
  }

  const createProduct = usePostProducts({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Produto criado'); invalidateProducts(); setModal(false) },
      onError: () => toast.error('Erro ao criar produto'),
    },
  })

  const updateProduct = usePutProductsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Produto actualizado'); invalidateProducts(); setModal(false) },
      onError: () => toast.error('Erro ao actualizar produto'),
    },
  })

  const deleteProduct = useDeleteProductsId({
    client: { headers },
    mutation: {
      onSuccess: () => { toast.success('Produto eliminado'); invalidateProducts() },
      onError: () => toast.error('Erro ao eliminar produto'),
    },
  })

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [products, q]
  )

  const stats = useMemo(() => ({
    total: products.length,
    stock: products.reduce((s, p) => s + (p.stock ?? 0), 0),
    baixo: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 8).length,
    esgotado: products.filter((p) => (p.stock ?? 0) === 0).length,
  }), [products])

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (Number(o.price) || 0), 0), [orders])

  const openEdit = (prod: Product) => { setEditing(prod); setModal(true) }
  const openNew = () => { setEditing(null); setModal(true) }
  const closeModal = () => { if (saving) return; setModal(false); setEditing(null) }

  const handleSave = async (form: ProdForm) => {
    setSaving(true)
    try {
      const photoPayload = form.photo ? [form.photo] : undefined

      const translationsPayload = Object.keys(form.translations).length > 0 ? form.translations : undefined
      if (editing) {
        await updateProduct.mutateAsync({
          id: editing.productId,
          data: {
            name: form.name || undefined,
            reference: form.reference || undefined,
            price: form.price ? Number(form.price) : undefined,
            stock: form.stock !== '' ? Number(form.stock) : undefined,
            description: form.description || undefined,
            categoryId: form.categoryId || undefined,
            photos: photoPayload,
            translations: translationsPayload,
          } as any,
        })
      } else {
        await createProduct.mutateAsync({
          data: {
            name: form.name,
            reference: form.reference || undefined,
            price: form.price ? Number(form.price) : undefined,
            stock: form.stock !== '' ? Number(form.stock) : undefined,
            description: form.description || undefined,
            categoryId: form.categoryId || undefined,
            photos: photoPayload,
            translations: translationsPayload,
          } as any,
        })
      }
    } catch (e) {
      // mutateAsync rejeita quando a API devolve erro — onError já mostra o toast,
      // mas capturamos aqui para evitar unhandled promise rejection
      if (!(e as any)?.name?.includes('Axios') && !(e as any)?.isAxiosError) {
        toast.error(e instanceof Error ? e.message : 'Erro ao guardar produto')
      }
    } finally {
      setSaving(false)
    }
  }

  const isPending = saving || createProduct.isPending || updateProduct.isPending

  return (
    <div>
      <PageHeader title="Loja" subtitle="Gere produtos, stock e encomendas.">
        <Button icon="plus" onClick={openNew}>Novo produto</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: 'Produtos', v: stats.total, i: 'box', t: 'blue' as const },
          { l: 'Em stock', v: stats.stock, i: 'package', t: 'green' as const },
          { l: 'Stock baixo', v: stats.baixo, i: 'trend', t: 'amber' as const },
          { l: 'Esgotados', v: stats.esgotado, i: 'ban', t: 'red' as const },
        ].map((s) => (
          <Card key={s.l} className="p-4 flex items-center gap-3">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${BADGE_TONES[s.t]}`}>
              <Icon name={s.i} className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{s.v}</p>
              <p className="text-[13px] text-zinc-500">{s.l}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-5">
        {([['produtos', 'Produtos'], ['encomendas', 'Encomendas'], ['categorias', 'Categorias']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === id ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'produtos' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Icon name="search" className="w-[18px] h-[18px]" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Procurar produto…"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm pl-10 pr-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {loadingProds ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-36 bg-zinc-100 dark:bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <ProdutoCard
                  key={p.productId}
                  p={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => confirm(`Eliminar "${p.name}"?`) && deleteProduct.mutate({ id: p.productId })}
                />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon="search" title="Sem produtos" desc="Não há produtos que correspondam à pesquisa." />
            </Card>
          )}
        </div>
      )}

      {tab === 'encomendas' && (
        <div>
          <Card className="p-4 mb-4 flex items-center gap-3 w-fit">
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${BADGE_TONES.green}`}>
              <Icon name="euro" className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(totalRevenue)}</p>
              <p className="text-[13px] text-zinc-500">Total faturado</p>
            </div>
          </Card>
          <Card className="overflow-hidden">
            {loadingOrders ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="font-medium px-4 sm:px-5 py-3">ID</th>
                      <th className="font-medium px-4 py-3">Total</th>
                      <th className="font-medium px-4 py-3 hidden md:table-cell">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400">Nenhuma encomenda encontrada.</td></tr>
                    )}
                    {orders.map((o) => (
                      <tr key={o.orderId} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                        <td className="px-4 sm:px-5 py-3.5 font-mono text-xs text-zinc-500">{o.orderId.slice(0, 8)}…</td>
                        <td className="px-4 py-3.5 font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(Number(o.price))}</td>
                        <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-PT') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="max-w-xl space-y-3">
          {/* Add category */}
          {newCatVisible ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveCat(null); if (e.key === 'Escape') { setNewCatVisible(false); setNewCatName('') } }}
                placeholder="Nome da categoria…"
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
              />
              <Button size="sm" onClick={() => saveCat(null)} disabled={putCategory.isPending}>Criar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setNewCatVisible(false); setNewCatName('') }}>Cancelar</Button>
            </div>
          ) : (
            <Button icon="plus" variant="ghost" size="sm" onClick={() => { setNewCatVisible(true); setNewCatName('') }}>Nova categoria</Button>
          )}

          {/* Category list */}
          {categories.map((cat) => (
            <Card key={cat.categoryId} className="p-4">
              {/* Category header */}
              <div className="flex items-center gap-2">
                <Icon name="folder" className="w-4 h-4 text-accent shrink-0" />
                {editCat?.id === cat.categoryId ? (
                  <input
                    autoFocus
                    value={editCat.name}
                    onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCat(cat.categoryId); if (e.key === 'Escape') setEditCat(null) }}
                    className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent font-medium"
                  />
                ) : (
                  <span className="flex-1 font-medium text-zinc-800 dark:text-zinc-100">{cat.name}</span>
                )}
                {editCat?.id === cat.categoryId ? (
                  <>
                    <Button size="sm" onClick={() => saveCat(cat.categoryId)} disabled={putCategory.isPending}>Guardar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditCat(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditCat({ id: cat.categoryId, name: cat.name })}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Editar"
                    ><Icon name="edit" className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => setTransModal({ id: cat.categoryId, name: cat.name, translations: (cat as any).translations ?? {}, type: 'cat' })}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                      title="Traduções"
                    ><Icon name="globe" className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => { if (confirm(`Eliminar categoria "${cat.name}"?`)) delCategory.mutate({ id: cat.categoryId }) }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      title="Eliminar"
                    ><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>

              {/* Subcategories */}
              <div className="mt-2.5 ml-6 space-y-1.5">
                {(cat.subcategories ?? []).map((sub) => (
                  <div key={sub.subcategoryId} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                    {editSub?.id === sub.subcategoryId ? (
                      <input
                        autoFocus
                        value={editSub.name}
                        onChange={(e) => setEditSub({ ...editSub, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveSub(sub.subcategoryId, cat.categoryId); if (e.key === 'Escape') setEditSub(null) }}
                        className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-0.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{sub.name}</span>
                    )}
                    {editSub?.id === sub.subcategoryId ? (
                      <>
                        <Button size="sm" onClick={() => saveSub(sub.subcategoryId, cat.categoryId)} disabled={putSubcategory.isPending}>Guardar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditSub(null)}>Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditSub({ id: sub.subcategoryId, name: sub.name, categoryId: cat.categoryId })}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          title="Editar"
                        ><Icon name="edit" className="w-3 h-3" /></button>
                        <button
                          onClick={() => setTransModal({ id: sub.subcategoryId, name: sub.name, translations: (sub as any).translations ?? {}, type: 'sub', categoryId: cat.categoryId })}
                          className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-accent/10 transition"
                          title="Traduções"
                        ><Icon name="globe" className="w-3 h-3" /></button>
                        <button
                          onClick={() => { if (confirm(`Eliminar subcategoria "${sub.name}"?`)) delSubcategory.mutate({ id: sub.subcategoryId }) }}
                          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                          title="Eliminar"
                        ><Icon name="trash" className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                ))}

                {/* Add subcategory */}
                {newSubCatId === cat.categoryId ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                    <input
                      autoFocus
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveSub(null, cat.categoryId); if (e.key === 'Escape') { setNewSubCatId(null); setNewSubName('') } }}
                      placeholder="Nome da subcategoria…"
                      className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-0.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent"
                    />
                    <Button size="sm" onClick={() => saveSub(null, cat.categoryId)} disabled={putSubcategory.isPending}>Criar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setNewSubCatId(null); setNewSubName('') }}>Cancelar</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNewSubCatId(cat.categoryId); setNewSubName('') }}
                    className="mt-1 text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <Icon name="plus" className="w-3 h-3" /> Nova subcategoria
                  </button>
                )}
              </div>
            </Card>
          ))}

          {categories.length === 0 && !newCatVisible && (
            <p className="text-sm text-zinc-400 py-12 text-center">Sem categorias ainda. Cria a primeira!</p>
          )}
        </div>
      )}

      <ProdutoModal
        open={modal}
        produto={editing}
        categories={categories}
        onClose={closeModal}
        onSave={handleSave}
        isPending={isPending}
      />

      {/* Translation modal for categories / subcategories */}
      {transModal && (
        <Modal
          open
          onClose={() => setTransModal(null)}
          title={`Traduções — ${transModal.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setTransModal(null)}>Cancelar</Button>
              <Button onClick={saveTranslations} disabled={putCategory.isPending || putSubcategory.isPending}>Guardar</Button>
            </>
          }
        >
          <TranslationInputs
            value={transModal.translations}
            onChange={(translations) => setTransModal((m) => m ? { ...m, translations } : null)}
            fields={['name']}
            namePlaceholder="Nome traduzido"
          />
        </Modal>
      )}
    </div>
  )
}

