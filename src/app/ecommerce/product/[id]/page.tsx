import routes from '@/routes'
import { DataTable } from '@/components/shadcn/data-table'
import { getOrdersproductProductidId } from '@/servers/backoffice/hooks/useGetOrdersproductProductidId'
import { GetOrdersproductProductidId200 } from '@/servers/backoffice/types/GetOrdersproductProductidId'
import { authOptions } from '@/app/api/auth/authOptions'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { columns } from './columns'

export default async function ProductPageOrder({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let productOrders: GetOrdersproductProductidId200 | null = null
  const session = await getServerSession(authOptions)
  let error = null

  if (!session) {
    redirect(routes.login)
  }

  if (!id) {
    return <div>Product ID is required</div>
  }

  try {
    productOrders = await getOrdersproductProductidId(id, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })
  } catch (errors) {
    error = errors
  }

  if (error) {
    return <div>Ocorreu um erro ao buscar as encomendas do produto.</div>
  }

  if (productOrders && productOrders.length === 0) {
    return <div>Product orders not found</div>
  }

  return (
    <>
      <DataTable columns={columns} data={[]} />
    </>
  )
}
