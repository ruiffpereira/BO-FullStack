'use client'
import routes from '@/routes'
import { useGetOrdersCustomerId } from '@/servers/backoffice/hooks/useGetOrdersCustomerId'
import { useSession } from 'next-auth/react'
import { redirect, useParams } from 'next/navigation'

import { AiOutlineLoading3Quarters } from 'react-icons/ai'

export default function CustomersOrders() {
  const { data: session, status } = useSession()

  const { id } = useParams<{ id: string }>()

  const { data: orders, isLoading } = useGetOrdersCustomerId(id, {
    client: {
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    },
  })

  if (status === 'loading' && isLoading) {
    return (
      <div>
        <AiOutlineLoading3Quarters />
      </div>
    )
  }

  if (!session) {
    redirect(routes.login)
  }

  if (!id) {
    return <div>Customer ID is required</div>
  }

  if (!orders || orders.length === 0) {
    return <div>No orders found for this customer.</div>
  }

  return (
    <div>
      {orders?.map((order) => (
        <div key={order.customerId}>
          <h2>Order ID: {order.customerId}</h2>
          <p>Order Date: {order.status}</p>
          <p>Total Amount: ${order.total}</p>
          {/* Add more order details as needed */}
        </div>
      ))}
    </div>
  )
}
