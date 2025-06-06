'use client'

import { Session } from 'next-auth'
import { useGetOrders } from '@/servers/backoffice/hooks/useGetOrders'
import { HiOutlineShoppingBag, HiOutlineCurrencyEuro } from 'react-icons/hi2'

export function OrdersByUser({ session }: { session: Session }) {
  const {
    data: orders,
    isLoading,
    isError,
  } = useGetOrders({
    client: {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  })

  if (isLoading) {
    return <div>Loading orders...</div>
  }
  if (isError) {
    return <div>Error loading orders.</div>
  }

  // Cálculo do total faturado
  const totalRevenue =
    orders?.rows?.reduce((sum, order) => sum + (Number(order.price) || 0), 0) ||
    0

  return (
    <div className="space-y-10">
      {/* Card de total faturado */}
      <div className="mx-auto flex max-w-xs flex-col items-center rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-100 to-yellow-200 p-6 shadow-lg">
        <HiOutlineCurrencyEuro className="mb-2 text-4xl text-yellow-500" />
        <span className="text-3xl font-extrabold text-yellow-700">
          {totalRevenue.toLocaleString('pt-PT', {
            style: 'currency',
            currency: 'EUR',
          })}
        </span>
        <span className="mt-1 text-base font-medium text-yellow-800">
          Total Faturado
        </span>
      </div>

      {/* Lista de encomendas */}
      <div>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-800">
          <HiOutlineShoppingBag className="text-blue-500" /> Encomendas
        </h2>
        {orders && orders.rows && orders.rows.length > 0 ? (
          <div className="grid gap-6">
            {orders.rows.map((order) => (
              <div
                key={order.orderId}
                className="rounded-xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-200 hover:shadow-xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('pt-PT')
                      : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-gray-700">
                    <span className="font-medium">Cliente Name:</span>{' '}
                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-gray-800">
                      {order.createdAt || 'N/A'}
                    </span>
                  </div>
                  <div className="text-gray-700">
                    <span className="font-medium">Total:</span>{' '}
                    <span className="inline-block rounded bg-yellow-100 px-2 py-0.5 text-yellow-800">
                      {(Number(order.price) || 0).toLocaleString('pt-PT', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </span>
                  </div>
                  <div className="font-semibold text-green-700">
                    Status: <span className="ml-1">Pago</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-gray-500">
            Nenhuma encomenda encontrada para este utilizador.
          </div>
        )}
      </div>
    </div>
  )
}
