import { Fragment, useState } from 'react'
import Products from './products'
import { getAllProducts } from '@/pages/api/product'
import { getAllOrders } from '@/pages/api/order'
import Orders from './orders'
import CategoryList from '@/components/product/categoryform'
import Link from 'next/link'
import { checkSession } from '@/utils/checkSession'
import { checkUserPermission } from '@/pages/api/userPermission'

function Ecommerce({ token, products, orders, error }) {
  const [categoryForm, setCategoryForm] = useState(false)

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!products) {
    return <div>Loading...</div>
  }

  return (
    <Fragment>
      <div className="flex justify-end gap-2 items-center mb-4">
        <Link
          href="/dashboard/ecommerce/products/newProduct"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Adicionar Peça
        </Link>
        <button
          onClick={() => setCategoryForm(!categoryForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {!categoryForm ? <div>Gerir Categorias</div> : <div>Ecommerce</div>}
        </button>
      </div>
      {!categoryForm ? (
        <div>
          <Products products={products} />
          <Orders orders={orders} />
        </div>
      ) : (
        <Fragment>
          <CategoryList token={token} />
        </Fragment>
      )}
    </Fragment>
  )
}

export default Ecommerce

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)

  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  const { token } = sessionCheckResult.props

  const componentPermission = await checkUserPermission(token, {
    componentNames: ['VIEW_ORDERS', 'VIEW_PRODUCTS'],
  })

  if (!componentPermission.VIEW_ORDERS || !componentPermission.VIEW_PRODUCTS) {
    return {
      notFound: true,
    }
  }

  try {
    const products = await getAllProducts(token)
    const orders = await getAllOrders(token)

    return {
      props: { token, products, orders },
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    return {
      props: { error },
    }
  }
}
