'use client'

import { Columns } from './columns'
import { DataTable } from '../../shadcn/data-table'
import { useGetProducts } from '@/servers/backoffice/hooks/useGetProducts'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'

export default function PageTableProducts() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
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
      <DataTable
        columns={Columns(queryClient, session?.accessToken ?? '')}
        data={products.rows ?? []}
      />
    </div>
  )
}
