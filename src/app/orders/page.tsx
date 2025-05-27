import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import { OrdersByUser } from '@/components/orders/ordersByUser'

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(routes.login)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <OrdersByUser session={session} />
      </div>
    </div>
  )
}
