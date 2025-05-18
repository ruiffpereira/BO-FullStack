import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Product } from '@/server/backoffice/types/Product'

type TableProps = {
  headers: string[]
  data: Product[]
}

export default function GenericTable({ headers, data }: TableProps) {
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
