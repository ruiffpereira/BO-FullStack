import { authOptions } from '@/app/api/auth/authOptions'
import { OrdersByCustomer } from '@/components/orders/ordersByCustomers'
import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function CustomersOrders({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session) {
    redirect(routes.login)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <OrdersByCustomer session={session} id={id} />
      </div>
    </div>
  )
}
