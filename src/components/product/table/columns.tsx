'use client'

import { ColumnDef, Row } from '@tanstack/react-table'
import { Product } from '@/server/backoffice/types/Product'
import Link from 'next/link'
import routes from '@/routes/index'
import { PencilIcon, Trash } from 'lucide-react'
import { useDeleteProductsId } from '@/server/backoffice/hooks/useDeleteProductsId'
import {
  postProductsMutationKey,
  PostProductsMutationKey,
} from '@/server/backoffice/hooks/usePostProducts'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react' // Importar o hook useSession

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const columns = [
  {
    accessorKey: 'photos',
    header: 'Photos',
    cell: ({ row }: { row: Row<Product> }) => {
      const photos = row.original.photos
      return (
        <div>
          {photos.length > 0 ? (
            <div>tem fotos</div>
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
          dssad
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
      const queryClient = useQueryClient()
      const { data: session } = useSession()
      const { mutate: deleteProduct, isPending } = useDeleteProductsId({
        mutation: {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: postProductsMutationKey(),
            })
          },
          onError: (error) => {
            alert('Erro ao apagar produto')
            console.error(error)
          },
        },
        client: {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`, // Passar o token aqui
          },
        },
      })
      const productId = row.original.productId
      return (
        <div className="flex gap-2">
          <button className="cursor-pointer rounded bg-blue-500 px-4 py-2 text-white">
            <PencilIcon />
          </button>
          <button
            onClick={() => deleteProduct({ id: productId })}
            className="cursor-pointer rounded bg-red-500 px-4 py-2 text-white"
          >
            <Trash />
          </button>
        </div>
      )
    },
  },
]
