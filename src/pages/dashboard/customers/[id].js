import { Fragment } from 'react'
import { getCustomerById } from '@/pages/api/customer'
import { getOrderCustomerId } from '@/pages/api/order'
import { Table } from 'antd'
import Link from 'next/link'
import { checkSession } from '@/utils/checkSession'

function Client({ customer, orders }) {
  const columns = [
    {
      title: 'Referencia',
      dataIndex: 'orderId',
      render: (text, record) => (
        <Link
          href={{
            pathname: '/dashboard/ecommerce/orders/' + record.orderId,
          }}
        >
          {record.orderId}
        </Link>
      ),
    },
    {
      title: 'date',
      dataIndex: 'createdAt',
    },
    {
      title: 'quantity',
      dataIndex: 'quantity',
      render: () => <div>0</div>,
    },
    {
      title: 'status',
      dataIndex: 'status',
      render: () => <div>Pago</div>,
    },
  ]

  return (
    <Fragment>
      <div className="max-w-sm bg-white rounded-lg shadow-md overflow-hidden mb-2">
        <div className="flex items-center p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
            <div className="mt-2 flex gap-2">
              <span className="block font-bold text-gray-600">Email</span>
              <p className="text-gray-600">{customer.email}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="block font-bold text-gray-600">Contacto</span>
              <p className="text-gray-600">{customer.contact}</p>
            </div>
          </div>
        </div>
      </div>
      Table com as encomendas do cliente
      <Table columns={columns} dataSource={orders} />
    </Fragment>
  )
}

export default Client

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)

  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  // Se a sessão existir, você pode acessar o token
  const { token } = sessionCheckResult.props

  const { id } = context.query
  try {
    const customer = await getCustomerById(token, id)
    const orders = await getOrderCustomerId(token, id)
    if (!customer || !orders) {
      return {
        notFound: true, // Next.js retornará uma página 404
      }
    }

    return {
      props: {
        customer,
        orders,
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
