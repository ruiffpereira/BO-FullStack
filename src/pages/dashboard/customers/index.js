import { Fragment } from 'react'
import { getAllCustomers } from '@/pages/api/customer'
import { Table } from 'antd'
import Link from 'next/link'
import { checkSession } from '@/utils/checkSession'
import { checkUserPermission } from '@/pages/api/userPermission'
import Image from 'next/image'

function Clients({ customers }) {

  console.log(customers)

  const columns = [
    {
      title: 'Photo',
      dataIndex: 'photo',
      key: 'photo',
      render: (text, record) => (
        text && text !== 'N/A' ? (
          <Image
            src={record.photo}
            alt="client photo"
            width={40}
            height={40}
            className='rounded-full overflow-hidden'
          />
        ) : (
          <span>No Photo</span>
        )
      ),
    },
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
          className="shadow bg-white rounded-sm"
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

  const componentPermission = await checkUserPermission(token, {
    componentNames: ['VIEW_CUSTOMERS'],
  })

  if (!componentPermission.VIEW_CUSTOMERS) {
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
