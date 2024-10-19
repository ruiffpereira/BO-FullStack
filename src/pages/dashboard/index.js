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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Link
          href="/dashboard/ecommerce"
          className="flex flex-col shadow gap-2 rounded-lg bg-sky-800 p-4 hover:bg-sky-900 cursor-pointer transition-all"
        >
          <h1 className="text-xs text-white ">Encomendas do Mes</h1>
          <p className="text-white text-4xl">{orders.count}</p>
        </Link>
        <Link
          href="/dashboard/customers"
          className="flex flex-col shadow gap-2 rounded-lg bg-sky-800 p-4 hover:bg-sky-900 cursor-pointer transition-all"
        >
          <h1 className="text-xs text-white">Numero de Clientes</h1>
          <p className="text-white text-4xl">{clients.count}</p>
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
    console.error('Error fetching data:', error)
    return {
      props: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    }
  }
}
