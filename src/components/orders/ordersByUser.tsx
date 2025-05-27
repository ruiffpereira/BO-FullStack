'use client'

import { Session } from 'next-auth'
import { useGetOrders } from '@/servers/backoffice/hooks/useGetOrders'

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

  return (
    <>
      {orders && orders.rows && orders.rows.length > 0 ? (
        orders?.rows?.map((order) => (
          <div key={order.customerId} className="mb-4 border p-4">
            <h3 className="text-lg font-semibold">
              Order ID: {order.customerId}
            </h3>
            <p>Status: {order.status}</p>
            <p>Total: ${order.total.toFixed(2)}</p>
            <p>Created At: {order.status}</p>
          </div>
        ))
      ) : (
        <div>No orders found for this user.</div>
      )}
    </>
  )
}
