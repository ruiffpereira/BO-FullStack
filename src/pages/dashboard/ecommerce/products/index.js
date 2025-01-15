import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Table } from 'antd'
import { checkSession } from '@/utils/checkSession'

const URL_RAIZ = process.env.NEXT_PUBLIC_CONTAINERRAIZ

function AddProduct({ products }) {
  const columns = [
    {
      title: 'Photos',
      dataIndex: 'photos',
      render: (photos, record) => (
        <Link className="flex gap-2" href={{
          pathname: '/dashboard/ecommerce/products/' + record.productId,
        }}>
          {Array.isArray(photos) && photos.length > 0 ? (
            <Image
              width={50}
              height={50}
              src={`${URL_RAIZ}/${photos[0]}`}
              alt="Photo 0"
              className="w-16 h-16 object-contain rounded-md"
            />
          ) : (
            <span>No photos available</span>
          )}
        </Link>
      ),
    },
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
    // {
    //   title: 'Action',
    //   key: 'action',
    //   render: () => <Link href={'clients/'}>Historico</Link>,
    // },
  ]

  return (
    <Fragment>
      <h1 className="text-3xl font-bold mb-4">Tabela de Peças</h1>
      <Table
        className="shadow bg-white rounded-sm"
        rowKey={(record) => record.productId}
        columns={columns}
        dataSource={products?.rows ?? []}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }} // Adiciona scroll horizontal para telas menores
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
