'use client'

import { columns } from './columns'
import { DataTable } from './data-table'
import { useGetProducts } from '@/server/backoffice/hooks/useGetProducts'
import { useSession } from 'next-auth/react'

export default function PageTableProducts() {
  const { data: session } = useSession()
  const { data: products, isLoading } = useGetProducts({
    client: {
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    },
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!products) {
    return <div>No products found</div>
  }

  return (
    <div>
      <DataTable columns={columns} data={products.rows ?? []} />
    </div>
  )
}
