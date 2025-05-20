import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table'
import { Product } from '@/server/backoffice/types/Product'
import Link from 'next/link'
import EditButton from './edit-button'
import DeleteButton from './delete-button'

type TableProps = {
  headers: string[]
  data: Product[]
  onEdit?: () => void
  onDelete?: () => void
  hiperlink?: [string, string, string]
}

export default function GenericTable({
  headers,
  data,
  onEdit,
  onDelete,
  hiperlink,
}: TableProps) {
  // console.log('headers', headers)
  // console.log('hiperlink', hiperlink?.[1])
  return (
    <Table className="rounded-lg border-1 border-gray-50 bg-white shadow-md">
      <TableHeader className="text-lg">
        <TableRow>
          {headers.map((header) => (
            //console.log('header', header),
            <TableHead key={header}>{header}</TableHead>
          ))}
          {onEdit && <TableHead>Editar</TableHead>}
          {onDelete && <TableHead>Apagar</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, idx) => (
          <TableRow key={idx}>
            {headers.map((header) => (
              <TableCell key={header}>
                {hiperlink && header == hiperlink[0] ? (
                  <>
                    <Link
                      href={`${hiperlink[1]}/${item[hiperlink[2] as keyof Product]}`}
                    >
                      {item[header as keyof Product]}
                    </Link>
                  </>
                ) : (
                  item[header as keyof Product]
                )}
              </TableCell>
            ))}
            {onEdit && (
              <TableCell>
                <EditButton />
              </TableCell>
            )}
            {onDelete && <TableCell>{/* <DeleteButton  /> */}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
