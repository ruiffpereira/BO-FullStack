import Link from 'next/link'
import { Fragment } from 'react'
import { Table } from 'antd'
import { checkSession } from '@/utils/checkSession'

function Orders({ orders }) {
  const columns = [
    {
      title: 'Referencia Encomenda',
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
      title: 'Clients',
      dataIndex: 'Customer',
      render: (text, record) => (
        <Link
          href={{
            pathname: '/dashboard/customers/' + record.customer.customerId,
          }}
        >
          {record.customer.name}
        </Link>
      ),
    },
    {
      title: 'TotalPrice',
      dataIndex: 'clientID',
      render: () => <div>99€</div>,
    },
    {
      title: 'Quantidade',
      dataIndex: 'amount',
      render: () => <div>3</div>,
    },
    {
      title: 'Morada',
      dataIndex: 'contact',
      render: () => <div>Rua das Cumieiras</div>,
    },
  ]

  return (
    <Fragment>
      <h1 className="text-4xl font-bold mb-4">Lista de Encomendas</h1>
      <Table
        className="shadow bg-white rounded-sm"
        rowKey={(record) => record.orderId}
        columns={columns}
        dataSource={orders?.rows ?? []}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }} // Adiciona scroll horizontal para telas menores
      />
    </Fragment>
  )
}

export default Orders

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)
  if (sessionCheckResult) {
    return sessionCheckResult
  }
  return {
    props: {},
  }
}
