import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Table } from 'antd'
import { checkSession } from '@/utils/checkSession'

const URL_RAIZ = process.env.NEXT_PUBLIC_CONTAINERRAIZ

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
      render: (photos) => (
        <div className="flex gap-2">
          {Array.isArray(photos) && photos.length > 0 ? (
            <Image
              style={{ width: 'auto', height: 'auto' }}
              width={50}
              height={50}
              src={`${URL_RAIZ}/${photos[0]}`}
              alt="Photo 0"
              className="w-16 h-16 object-cover rounded-md"
            />
          ) : (
            <span>No photos available</span>
          )}
        </div>
      ),
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
        dataSource={products?.rows ?? []}
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
