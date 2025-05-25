import LoginComponent from '@/components/login/autentication'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/authOptions'
import { redirect } from 'next/navigation'
import routes from '@/routes'

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect(routes.dashboard)
  }

  return (
    <>
      <LoginComponent />
    </>
  )
}
