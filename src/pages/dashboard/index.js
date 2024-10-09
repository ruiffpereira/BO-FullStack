import Link from 'next/link'
import { getAllCustomers } from '@/pages/api/customer'
import { getAllOrders } from '@/pages/api/order'
import { checkSession } from '@/utils/checkSession'
import { useSession } from 'next-auth/react'

function Dashboard({ clients, orders }) {
  const { data: status } = useSession()

  if (!clients) {
    return <div>Loading...</div>
  }
  if (status === 'loading') {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Link
          href="/dashboard/ecommerce"
          className="flex flex-col gap-2 border rounded-sm border-black p-4 hover:bg-slate-300 cursor-pointer transition-all"
        >
          <h1 className="text-xs">Encomendas do Mes</h1>
          <p className="text-slate">{orders.count}</p>
        </Link>
        <Link
          href="/dashboard/customers"
          className="flex flex-col gap-2 border rounded-sm border-black p-4 hover:bg-slate-300 cursor-pointer transition-all"
        >
          <h1 className="text-xs">Numero de Clientes</h1>
          <p className="text-slate">{clients.count}</p>
        </Link>
      </div>
    </div>
  )
}

export default Dashboard

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)

  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  const { token } = sessionCheckResult.props
  try {
    const [clients, orders] = await Promise.all([
      getAllCustomers(token),
      getAllOrders(token),
    ])
    return {
      props: { clients, orders },
    }
  } catch (error) {
    console.log(error)
    console.error('Error fetching data:', error)
    return {
      props: { error },
    }
  }
}
