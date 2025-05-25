'use client'

import { ColumnDef, Row } from '@tanstack/react-table'
import { Product } from '@/server/backoffice/types/Product'
import Link from 'next/link'
import routes from '@/routes/index'
import { PencilIcon, Trash } from 'lucide-react'
import { useDeleteProductsId } from '@/server/backoffice/hooks/useDeleteProductsId'
import { postProductsMutationKey } from '@/server/backoffice/hooks/usePostProducts'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { toast } from 'sonner'
import Image from 'next/image'

export const columns = (
  queryClient: QueryClient,
  token: string,
): ColumnDef<Product>[] => [
  {
    accessorKey: 'photos',
    header: 'Photos',
    cell: ({ row }: { row: Row<Product> }) => {
      const photos = row.original.photos
      return (
        <div>
          {photos.length > 0 ? (
            <Image
              src={`${process.env.NEXT_PUBLIC_CONTAINERRAIZ}/${photos[0].slice(2)}`}
              alt={row.original.name}
              width={50}
              height={50}
              className="rounded-md"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gray-200">
              <span className="text-gray-500">No Image</span>
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'name',
    header: 'Namee',
    cell: ({ row }: { row: Row<Product> }) => {
      const productId = row.original.productId
      return (
        <Link
          href={`${routes.product}/${productId}`}
          className="text-blue-500 hover:underline"
        >
          {row.original.name}
        </Link>
      )
    },
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
    accessorKey: 'options',
    header: 'Options',
    cell: ({ row }: { row: Row<Product> }) => {
      const { mutate: deleteProduct, isPending } = useDeleteProductsId({
        mutation: {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: postProductsMutationKey(),
            })
            toast.success('Delete product success', {
              style: { background: '#22c55e', color: '#fff' },
            })
          },
          onError: (error) => {
            toast.error('Error deleting product', {
              style: { background: '#ef4444', color: '#fff' },
            })
            console.error(error)
          },
        },
        client: {
          headers: {
            Authorization: `Bearer ${token}`, // Passar o token aqui
          },
        },
      })
      const productId = row.original.productId
      return (
        <div className="flex gap-2">
          <Link
            className="cursor-pointer rounded bg-blue-500 px-4 py-2 text-white"
            href={routes.productEdit(productId)}
          >
            <PencilIcon />
          </Link>
          <button
            onClick={() => deleteProduct({ id: productId })}
            className="cursor-pointer rounded bg-red-500 px-4 py-2 text-white"
          >
            {isPending ? (
              <AiOutlineLoading3Quarters className="animate-spin text-xl" />
            ) : (
              <Trash />
            )}
          </button>
        </div>
      )
    },
  },
]
