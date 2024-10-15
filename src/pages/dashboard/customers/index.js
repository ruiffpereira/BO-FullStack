import { Fragment } from 'react'
import { getAllCustomers } from '@/pages/api/customer'
import { Table } from 'antd'
import Link from 'next/link'
import { checkSession } from '@/utils/checkSession'
import { checkUserPermission } from '@/pages/api/userPermission'

function Clients({ customers }) {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      test: '1',
      render: (text, record) => (
        <Link
          href={{
            pathname: '/dashboard/customers/' + record.customerId,
          }}
        >
          {text}
        </Link>
      ),
    },
    {
      title: 'Photo',
      dataIndex: 'clientID',
    },
    {
      title: 'Email',
      dataIndex: 'email',
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
    },
    // {
    //   title: 'Action',
    //   key: 'action',
    //   render: () => <Link href={'clients/'}>Historico</Link>,
    // },
  ]

  return (
    <Fragment>
      <div>
        <h1 className="text-4xl font-bold mb-4">Lista de Clientes</h1>
        <Table
          rowKey={customers.rows.customerId}
          columns={columns}
          dataSource={customers.rows}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </div>
    </Fragment>
  )
}

export default Clients

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)
  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  // Se a sessão existir, você pode acessar o token
  const { token } = sessionCheckResult.props

  const hasAccess = await checkUserPermission(token, {
    componentName: 'Customer',
  })

  if (hasAccess.hasAccess === false) {
    return {
      notFound: true,
    }
  }

  try {
    const customers = await getAllCustomers(token)

    return {
      props: { customers },
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    return {
      props: { error },
    }
  }
}
