import { Fragment } from 'react'
import { Table } from 'antd'
import { getOrderById } from '@/pages/api/order'
import Link from 'next/link'
import { checkSession } from '@/utils/checkSession'

function OrderDetails({ order }) {
  const columns = [
    {
      title: 'Produto',
      dataIndex: 'ProdutoiD',
      render: (text, record) => (
        <Link
          href={{
            pathname: '/dashboard/ecommerce/products/' + record.productId,
          }}
        >
          {record.name}
        </Link>
      ),
    },
    {
      title: 'Quantidade',
      dataIndex: 'amount',
      render: (text, record) => <div>{record.quantity}</div>,
    },
  ]

  return (
    <Fragment>
      <div>
        <div className="border border-gray-300 p-6 m-6 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-4">Detalhes da Encomenda</h2>
          <p className="mb-2">
            <strong>ID:</strong> {order[0].orderId}
          </p>
          <p className="mb-2">
            <strong>Morada:</strong> Rua das Cumieiras
          </p>
          <p className="mb-2">
            <strong>Data:</strong> {order[0].createdAt}
          </p>
          <p className="mb-2">
            <strong>Preco Total:</strong> 99€
          </p>
          <p className="mb-2">
            <strong>Cliente:</strong> {order[0].customer.name}
          </p>
        </div>
        <Table columns={columns} dataSource={order[0].products} />
      </div>
    </Fragment>
  )
}

export default OrderDetails

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)
  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }
  const { id } = context.query
  // Se a sessão existir, você pode acessar o token
  const { token } = sessionCheckResult.props

  try {
    const orderDetails = await getOrderById(token, id)

    const order =
      orderDetails?.rows?.length > 0
        ? orderDetails.rows.map((row) => {
            const { orderId, customer, products, createdAt } = row
            return {
              orderId,
              createdAt,
              customer,
              products: products.map((product) => ({
                productId: product.productId,
                name: product.name,
                reference: product.reference,
                stock: product.stock,
                price: product.price,
                description: product.description,
                photos: product.photos,
                categoryId: product.categoryId,
                subcategoryId: product.subcategoryId,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                deletedAt: product.deletedAt,
                quantity: product.OrderProduct.quantity,
              })),
            }
          })
        : []

    if (order.length === 0) {
      return {
        notFound: true, // Next.js retornará uma página 404
      }
    }

    return {
      props: {
        order,
      },
    }
  } catch (error) {
    return {
      props: {
        error: error.message, // Retorna a mensagem de erro
      },
    }
  }
}
