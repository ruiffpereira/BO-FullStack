import Link from 'next/link'
import { getAllCustomers } from '@/pages/api/customer'
import { getAllOrders } from '@/pages/api/order'
import { checkSession } from '@/utils/checkSession'
import { useSession } from 'next-auth/react'
import useSWR, { useSWRConfig } from 'swr'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL


function Dashboard({ clients, orders, token }) {
  const { data: status } = useSession()


  const urlSWRUser = `${BASE_URL}/clients`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  console.log("aqui", token)

  const fetcher = (url) => {
    return fetch(url, {
      headers,
    }).then((res) => res.json())
  }

  const { data: users, isLoading } = useSWR(urlSWRUser, fetcher)

  console.log("aqui", users)

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
  console.log("token", token)

  try {
    const [clients, orders] = await Promise.all([
      getAllCustomers(token),
      getAllOrders(token),
    ])

    return {
      props: { clients, orders, token },
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
