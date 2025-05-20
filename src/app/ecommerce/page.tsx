import SquareButton from '@/components/buttons/square-button'
import GenericTable from '@/components/table/table'
import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { getProducts } from '@/server/backoffice/hooks/useGetProducts'
import { authOptions } from '../api/auth/[...nextauth]/route'

export default async function EcommercePage() {
  const session = await getServerSession(authOptions)
  let products

  if (!session) {
    redirect(routes.login)
  }

  try {
    products = await getProducts({
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    })
  } catch (error) {
    //console.log('products', error)
    return (
      <div className="grid h-full place-items-center text-2xl font-bold">
        Erro No Servidor
      </div>
    )
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
        <GenericTable
          headers={['photos', 'name', 'stock', 'price']}
          data={products.rows ?? []}
          onEdit={() => {
            console.log('edit')
          }}
          onDelete={() => {
            console.log('delete')
          }}
          hiperlink={['name', routes.product, 'productId']}
        />
      </div>
    </div>
  )
}
