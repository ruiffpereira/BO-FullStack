'use client'
import { ColumnDef } from '@tanstack/react-table'
import { Customer } from '@/server/backoffice/types/Customer'
import Image from 'next/image'

// Exemplo de columns para a tabela de clientes
export const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'photo',
    header: 'Photo',
    cell: ({ row }: { row: { original: Customer } }) => {
      return (
        <>
          {row.original.photo ? (
            <Image
              src={row.original.photo}
              alt="Customer Photo"
              className="h-10 w-10 rounded-full"
              width={40}
              height={40}
            />
          ) : (
            <span className="text-gray-500">No Image</span>
          )}
        </>
      )
    },
  },
  {
    accessorKey: 'name',
    header: 'Nome',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'contact',
    header: 'Contato',
  },
]
