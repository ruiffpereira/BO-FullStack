import SquareButton from '@/components/buttons/square-button'
import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getProducts } from '@/server/backoffice/hooks/useGetProducts'
import { authOptions } from '../api/auth/[...nextauth]/route'
import { columns } from '@/components/product/table/columns'
import { DataTable } from '@/components/product/table/data-table'
import PageTableProducts from '@/components/product/table/page-table'

export default async function EcommercePage() {
  const session = await getServerSession(authOptions)
  let products

  if (!session) {
    redirect(routes.login)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <SquareButton
          buttonText="Configurar Produtos e Categorias"
          redirectPage={routes.addProduct}
        />
        <SquareButton
          buttonText="Lista de Encomendas"
          redirectPage={routes.addProduct}
        />
        <SquareButton
          buttonText="Lista de Produtos"
          redirectPage={routes.addProduct}
        />
      </div>
      <div>
        <PageTableProducts />
      </div>
    </div>
  )
}
