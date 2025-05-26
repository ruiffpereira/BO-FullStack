'use client'
import routes from '@/routes'
import { useGetOrdersCustomerId } from '@/servers/backoffice/hooks/useGetOrdersCustomerId'
import { c } from '@kubb/core/dist/logger-BWq-oJU_.js'
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

  console.log('Customer ID:', orders)

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
      <h1>Customers Orders</h1>
      <p>Orders for customers will be displayed here.</p>
    </div>
  )
}
