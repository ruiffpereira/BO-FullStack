"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Product} from "@/server/backoffice/types/Product"
import  Link from "next/link"
import routes from "@/routes/index"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "photos",
    header: "Photos",
    cell: ({ row }) => {
      {console.log('row', row.original)}
      const photos = row.original.photos
      return (
        <div
        >
          {photos.length > 0 ? (
            <div>tem fotos </div>
          ) : (
            <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500">No Image</span>
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "name",
    header: "Namee",
    cell: ({ row }) => {
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
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "price",
    header: "Price",
  },
]
