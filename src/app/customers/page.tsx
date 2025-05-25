import { getCustomers } from '@/server/backoffice/hooks/useGetCustomers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/authOptions'
import { GetCustomers200 } from '@/server/backoffice/types/GetCustomers'
import routes from '@/routes'
import { redirect } from 'next/navigation'

export default async function Customers() {
  const session = await getServerSession(authOptions)
  let customers: GetCustomers200 = [] as GetCustomers200

  if (!session) {
    redirect(routes.login)
  }

  try {
    if (session && session.accessToken) {
      customers = await getCustomers({
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
    }
  } catch (error) {
    console.error('Error fetching customers:', error)
    // Handle the error appropriately, e.g., show a message to the user
  }

  if (!customers || !customers.rows || customers.rows.length === 0) {
    return (
      <div>
        <h1>No Customers Found</h1>
        <p>There are no customers available at the moment.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Customers</h1>
      {/* <DataTable columns={columns} data={customers.rows} /> */}
    </div>
  )
}
