import { Fragment } from 'react'
import Link from 'next/link'
import { Table } from 'antd'
import { checkSession } from '@/utils/checkSession'

function AddProduct({ products }) {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
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
      title: 'Reference',
      dataIndex: 'reference',
    },
    {
      title: 'Price',
      dataIndex: 'price',
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
    },
    {
      title: 'Description',
      dataIndex: 'description',
    },
    {
      title: 'Category',
      dataIndex: 'categoryname',
      render: (text, record) =>
        record.category ? record.category.name : 'Sem Categoria',
    },
    {
      title: 'Photos',
      dataIndex: 'photos',
    },
    // {
    //   title: 'Action',
    //   key: 'action',
    //   render: () => <Link href={'clients/'}>Historico</Link>,
    // },
  ]

  return (
    <Fragment>
      <h1 className="text-3xl font-bold">Tabela de Peças</h1>
      <Table
        rowKey={products?.rows?.productId ?? 'defaultKey'}
        columns={columns}
        dataSource={products.rows}
      />
    </Fragment>
  )
}

export default AddProduct

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)
  if (sessionCheckResult) {
    return sessionCheckResult
  }

  return {
    props: {},
  }
}
