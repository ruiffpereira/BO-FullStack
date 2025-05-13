import SquareButton from '@/components/squarebutton'
import routes from '@/routes'

export default async function EcommercePage() {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
    </div>
  )
}
