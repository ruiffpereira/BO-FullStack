import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table'
import { Product } from '@/server/backoffice/types/Product'
import { FaTrash, FaPen } from 'react-icons/fa'

type TableProps = {
  headers: string[]
  data: Product[]
  onEdit?: () => void
  onDelete?: () => void
}

export default function GenericTable({ headers, data, onEdit, onDelete }: TableProps) {
  // console.log('headers', headers)
  //console.log('data', data)
  return (
    <Table>
      <TableHeader>
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
                {item[header as keyof Product]}
              </TableCell>
            ))}
            {onEdit && (
              <TableCell>
                {onDelete && (
                  <button
                    onClick={onEdit}
                    className=" hover:underline"
                  >
                    <FaPen />
                  </button>
                )}
            </TableCell>
            )}
            {onDelete && (
              <TableCell>
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="hover:underline"
                  >
                    <FaTrash />
                  </button>
                )}
            </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
