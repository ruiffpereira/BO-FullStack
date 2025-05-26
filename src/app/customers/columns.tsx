'use client'
import { ColumnDef } from '@tanstack/react-table'
import { Customer } from '@/servers/backoffice/types/Customer'
import Image from 'next/image'
import Link from 'next/link'
import routes from '@/routes'

// Exemplo de columns para a tabela de clientes
export const Columns: ColumnDef<Customer>[] = [
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
    cell: ({ row }: { row: { original: Customer } }) => {
      return (
        <Link
          className="pointer"
          href={routes.customer(row.original.customerId)}
        >
          {row.original.name || 'N/A'}
        </Link>
      )
    },
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
