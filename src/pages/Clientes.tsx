import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../ui/icons.jsx'
import { Card, Badge, Avatar, Modal, PageHeader, EmptyState, Button } from '../ui/ui.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import type { Customer } from '../gen/backoffice/types/Customer.js'

function colorFromName(name: string) {
  const colors = ['#2A6FDB', '#1F8A5B', '#D97757', '#7C5CDB', '#E6B450', '#0EA5A4']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
      {[1, 2, 3].map((i) => (
        <td key={i} className="px-4 sm:px-5 py-3.5">
          <div className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${50 + i * 15}%` }} />
        </td>
      ))}
      <td />
    </tr>
  )
}

export function Clientes() {
  const { authHeader } = useAuth()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Customer | null>(null)

  const { data, isLoading, isError } = useGetCustomers({
    client: { headers: authHeader() },
  })

  const customers = data?.rows ?? []

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.email.toLowerCase().includes(q.toLowerCase()),
    ),
  [customers, q])

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${data?.count ?? customers.length} clientes registados.`} />

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <Icon name="search" className="w-[18px] h-[18px]" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar por nome ou email…"
              className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="font-medium px-4 sm:px-5 py-3">Cliente</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Email</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">Contacto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              {isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-red-500 text-sm">
                    Erro ao carregar clientes.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && filtered.map((c) => (
                <tr
                  key={c.customerId}
                  onClick={() => setSel(c)}
                  className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer"
                >
                  <td className="px-4 sm:px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} color={colorFromName(c.name)} size={36} />
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-xs text-zinc-400 truncate md:hidden">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell truncate max-w-[200px]">{c.email}</td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell">{c.contact ?? '—'}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState icon="users" title="Sem clientes" desc="Não há clientes que correspondam à pesquisa." />
          )}
        </div>
      </Card>

      {sel && (
        <Modal
          open
          onClose={() => setSel(null)}
          title="Ficha de cliente"
          width="max-w-md"
          footer={<Button variant="outline" onClick={() => setSel(null)}>Fechar</Button>}
        >
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={sel.name} color={colorFromName(sel.name)} size={56} />
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{sel.name}</h3>
              <Badge tone="green" dot>Activo</Badge>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
              <Icon name="mail" className="w-4 h-4 text-zinc-400" />{sel.email}
            </div>
            {sel.contact && (
              <div className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
                <Icon name="phone" className="w-4 h-4 text-zinc-400" />{sel.contact}
              </div>
            )}
            <div className="flex items-center gap-2.5 text-zinc-400">
              <Icon name="layers" className="w-4 h-4 text-zinc-400" />
              <span className="font-mono text-xs">{sel.customerId}</span>
            </div>
          </div>
          {/*
            TODO: Histórico de encomendas/visitas.
            Requer endpoint GET /customers/:id/history ou filtros dedicados na API.
          */}
        </Modal>
      )}
    </div>
  )
}
