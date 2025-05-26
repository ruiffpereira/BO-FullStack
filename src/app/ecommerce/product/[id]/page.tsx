'use client'

import { useSession } from 'next-auth/react'
import routes from '@/routes'
import { redirect } from 'next/navigation'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { use } from 'react'
import { DataTable } from '@/components/shadcn/data-table'

export default function ProductPageOrder({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session, status } = useSession()
  const { id } = use(params)

  if (status === 'loading') {
    return (
      <div>
        <AiOutlineLoading3Quarters />
      </div>
    )
  }

  if (!session) {
    redirect(routes.login)
  }

  return (
    <>
      <DataTable columns={columns} data={[]} />
    </>
  )
}

export const columns = [
  {
    accessorKey: 'photos',
    header: 'Photos',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'price',
    header: 'Price',
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
]
