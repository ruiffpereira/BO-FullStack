import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import routes from '../../routes'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(routes.login)
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Dashboard</h1>
    </>
  )
}
