import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, Button, Input, Modal, PageHeader, EmptyState, IconButton, BADGE_TONES } from '../ui/ui.jsx'
import { usePageSubtitle } from '../context/PageMetaContext'
import { usePagination, Pagination } from '../components/Pagination'
import { Combobox } from '../components/Combobox'
import { DatePicker } from '../components/DatePicker'
import { useGetExpenses, getExpensesQueryKey } from '../gen/backoffice/hooks/useGetExpenses.js'
import { useGetExpensesSummary, getExpensesSummaryQueryKey } from '../gen/backoffice/hooks/useGetExpensesSummary.js'
import { usePostExpenses } from '../gen/backoffice/hooks/usePostExpenses.js'
import { usePatchExpensesId } from '../gen/backoffice/hooks/usePatchExpensesId.js'
import { useDeleteExpensesId } from '../gen/backoffice/hooks/useDeleteExpensesId.js'
import type { Expense } from '../gen/backoffice/types/Expense.js'
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  type ExpenseCategory,
} from '../hooks/useExpenseCategories'
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from '../utils/expenseCategories'

const fmtEur = (n: number) =>
  '€' + (n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const currentMonth = () => new Date().toISOString().slice(0, 7)

interface FormState {
  date: string
  description: string
  categoryId: string
  amount: string
  notes: string
}

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  categoryId: '',
  amount: '',
  notes: '',
})

function SummaryCard({ label, value, icon, tone, delta, sub, loading }: {
  label: string; value: string; icon: string; tone: keyof typeof BADGE_TONES
  delta?: number | null; sub?: string; loading?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${BADGE_TONES[tone]}`}>
          <Icon name={icon} className="w-[18px] h-[18px]" />
        </div>
        {delta !== undefined && delta !== null && delta !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
            <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="w-3 h-3" />
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <p className="text-2xl font-semibold text-zinc-900 dark:text-white mt-3 tabular-nums tracking-tight">{value}</p>
      )}
      <p className="text-[13px] text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </Card>
  )
}

// ── Modal de gestão de categorias ───────────────────────────────────────────
function CategoriesModal({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: ExpenseCategory[]
}) {
  const createMut = useCreateExpenseCategory()
  const updateMut = useUpdateExpenseCategory()
  const deleteMut = useDeleteExpenseCategory()
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)

  const reset = () => { setName(''); setColor(CATEGORY_COLORS[0]); setEditing(null) }

  const submit = async () => {
    if (!name.trim()) { toast.error('Indica um nome.'); return }
    try {
      if (editing?.expenseCategoryId) {
        await updateMut.mutateAsync({ id: editing.expenseCategoryId, name: name.trim(), color })
        toast.success('Categoria actualizada.')
      } else {
        await createMut.mutateAsync({ name: name.trim(), color })
        toast.success('Categoria criada.')
      }
      reset()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Não foi possível guardar.')
    }
  }

  const startEdit = (c: ExpenseCategory) => {
    setEditing(c); setName(c.name); setColor(c.color || DEFAULT_CATEGORY_COLOR)
  }

  const remove = async (c: ExpenseCategory) => {
    try {
      await deleteMut.mutateAsync(c.expenseCategoryId)
      toast.success('Categoria eliminada. As despesas ligadas ficam sem categoria.')
      if (editing?.expenseCategoryId === c.expenseCategoryId) reset()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Não foi possível eliminar.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Categorias de despesa" subtitle="Cria e organiza as tuas categorias." width="max-w-lg">
      <div className="space-y-4">
        {/* Form criar/editar */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
          <Input label={editing ? 'Editar categoria' : 'Nova categoria'} value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Ex: Renda" />
          <div>
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Cor</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editing && <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>}
            <Button size="sm" onClick={submit} isLoading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Adicionar'}
            </Button>
          </div>
        </div>

        {/* Lista */}
        {categories.length === 0 ? (
          <p className="text-sm text-zinc-400">Ainda não tens categorias. Cria a primeira acima.</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {categories.map((c) => (
              <div key={c.expenseCategoryId} className="flex items-center gap-3 py-2 group">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-200">{c.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconButton icon="edit" label="Editar" className="w-8 h-8" onClick={() => startEdit(c)} />
                  <IconButton icon="trash" label="Eliminar" className="w-8 h-8 hover:text-red-500" onClick={() => remove(c)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function Despesas() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()
  const headers = authHeader()
  const [month, setMonth] = useState(currentMonth())

  const [modalOpen, setModalOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null)

  const { data: catsData } = useExpenseCategories()
  const categories = useMemo(() => catsData ?? [], [catsData])
  const catColor = (id?: string | null) =>
    categories.find((c) => c.expenseCategoryId === id)?.color ?? DEFAULT_CATEGORY_COLOR
  const catName = (id?: string | null) =>
    categories.find((c) => c.expenseCategoryId === id)?.name ?? 'Sem categoria'

  const { data: listData, isLoading: loadingList } = useGetExpenses(
    { month },
    { client: { headers }, query: { staleTime: 0 } },
  )
  const { data: summary, isLoading: loadingSummary } = useGetExpensesSummary(
    { month },
    { client: { headers }, query: { staleTime: 0 } },
  )

  const rows = useMemo(() => listData?.rows ?? [], [listData])
  const pg = usePagination(rows, { resetKey: month })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getExpensesQueryKey({ month }) })
    qc.invalidateQueries({ queryKey: getExpensesSummaryQueryKey({ month }) })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMut = usePostExpenses({ client: { headers } })
  const updateMut = usePatchExpensesId({ client: { headers } })
  const deleteMut = useDeleteExpensesId({ client: { headers } })

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true) }
  const openEdit = (e: Expense) => {
    setEditing(e)
    setForm({
      date: e.date ?? new Date().toISOString().slice(0, 10),
      description: e.description ?? '',
      categoryId: e.categoryId ?? '',
      amount: e.amount !== undefined ? String(e.amount) : '',
      notes: e.notes ?? '',
    })
    setModalOpen(true)
  }

  const submit = async () => {
    const amountNum = Number(form.amount)
    if (!form.date || !form.description.trim() || Number.isNaN(amountNum) || amountNum < 0) {
      toast.error('Preenche data, descrição e um valor válido.')
      return
    }
    const payload = {
      date: form.date,
      description: form.description.trim(),
      categoryId: form.categoryId || null,
      amount: amountNum,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing?.expenseId) {
        await updateMut.mutateAsync({ id: editing.expenseId, data: payload })
        toast.success('Despesa actualizada.')
      } else {
        await createMut.mutateAsync({ data: payload })
        toast.success('Despesa registada.')
      }
      setModalOpen(false)
      invalidate()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Não foi possível guardar a despesa.')
    }
  }

  const doDelete = async () => {
    if (!confirmDelete?.expenseId) return
    try {
      await deleteMut.mutateAsync({ id: confirmDelete.expenseId })
      toast.success('Despesa eliminada.')
      setConfirmDelete(null)
      invalidate()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Não foi possível eliminar.')
    }
  }

  const byCategory = summary?.byCategory ?? []
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total ?? 0))
  const monthLabel = format(new Date(month + '-01T00:00:00'), 'MMMM yyyy', { locale: pt })
  usePageSubtitle(`Custos de ${monthLabel}.`)

  return (
    <div className="space-y-6">
      <PageHeader>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <Button variant="outline" icon="settings" onClick={() => setCatsOpen(true)}>Categorias</Button>
        <Button icon="plus" onClick={openCreate}>Nova despesa</Button>
      </PageHeader>

      {/* ── Resumo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Despesas do mês" icon="euro" tone="red" loading={loadingSummary}
          value={fmtEur(summary?.monthTotal ?? 0)} delta={summary?.monthChange ?? null}
          sub="vs. mês anterior"
        />
        <SummaryCard label="Despesas do ano" icon="calendar" tone="amber" loading={loadingSummary} value={fmtEur(summary?.yearTotal ?? 0)} />
        <SummaryCard
          label="Maior categoria" icon="trend" tone="violet" loading={loadingSummary}
          value={summary?.topCategory ?? '—'}
          sub={byCategory[0] ? fmtEur(byCategory[0].total ?? 0) : undefined}
        />
        <SummaryCard label="Mês anterior" icon="clock" tone="blue" loading={loadingSummary} value={fmtEur(summary?.prevMonthTotal ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Breakdown por categoria ── */}
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Por categoria</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-zinc-400">Sem despesas neste mês.</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((c) => (
                <div key={c.categoryId ?? 'none'}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color ?? DEFAULT_CATEGORY_COLOR }} />
                      {c.name ?? 'Sem categoria'}
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(c.total ?? 0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(((c.total ?? 0) / maxCat) * 100)}%`, background: c.color ?? DEFAULT_CATEGORY_COLOR }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Lista de despesas ── */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Lançamentos</h2>
            <span className="text-xs text-zinc-400">{rows.length} {rows.length === 1 ? 'despesa' : 'despesas'}</span>
          </div>
          {loadingList ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="euro" title="Sem despesas" desc="Regista a primeira despesa deste mês." action={<Button icon="plus" onClick={openCreate}>Nova despesa</Button>} />
          ) : (
            <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pg.pageItems.map((e) => (
                <div key={e.expenseId} className="flex items-center gap-3 px-5 py-3 group">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.category?.color ?? catColor(e.categoryId) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{e.description}</p>
                    <p className="text-xs text-zinc-400">
                      {e.date ? format(new Date(e.date + 'T00:00:00'), 'd MMM', { locale: pt }) : '—'} · {e.category?.name ?? catName(e.categoryId)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">{fmtEur(Number(e.amount) || 0)}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton icon="edit" label="Editar" onClick={() => openEdit(e)} className="w-8 h-8" />
                    <IconButton icon="trash" label="Eliminar" onClick={() => setConfirmDelete(e)} className="w-8 h-8 hover:text-red-500" />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-2"><Pagination {...pg} /></div>
            </>
          )}
        </Card>
      </div>

      {/* ── Modal criar/editar despesa ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar despesa' : 'Nova despesa'}
        subtitle={editing ? 'Actualiza os dados da despesa.' : 'Regista um novo custo do negócio.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submit} isLoading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Registar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Descrição" value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Fatura eletricidade" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Data</span>
              <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <Input label="Valor (€)" type="number" step={0.01} min={0} value={form.amount} onChange={(e: any) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Combobox
              label="Categoria"
              value={form.categoryId}
              onChange={(v) => setForm({ ...form, categoryId: v })}
              options={[{ value: '', label: 'Sem categoria' }, ...categories.map((c) => ({ value: c.expenseCategoryId, label: c.name }))]}
              placeholder="Sem categoria"
              searchPlaceholder="Pesquisar categoria…"
            />
            <button onClick={() => setCatsOpen(true)} className="mt-1.5 text-xs text-accent hover:underline">
              + Gerir categorias
            </button>
          </div>
          <Input label="Notas (opcional)" value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} placeholder="Detalhes adicionais" />
        </div>
      </Modal>

      {/* ── Confirmar eliminação ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar despesa"
        subtitle="Esta acção não pode ser revertida."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={doDelete} isLoading={deleteMut.isPending}>Eliminar</Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Eliminar <span className="font-semibold">{confirmDelete?.description}</span> ({fmtEur(Number(confirmDelete?.amount) || 0)})?
        </p>
      </Modal>

      {/* ── Modal gerir categorias ── */}
      <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} categories={categories} />
    </div>
  )
}
