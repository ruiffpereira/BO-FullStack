import SquareButton from '@/components/buttons/square-button'
import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import PageTableProducts from '@/components/product/table/page-table'

export default async function EcommercePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(routes.login)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <SquareButton
          buttonText="Lista de Encomendas"
          redirectPage={routes.orders}
        />
        <SquareButton
          buttonText="Configurar Produtos"
          redirectPage={routes.addProduct}
        />

        <SquareButton
          buttonText="Configurar Categorias"
          redirectPage={routes.categories}
        />
      </div>
      <div>
        <PageTableProducts />
      </div>
    </div>
  )
}
