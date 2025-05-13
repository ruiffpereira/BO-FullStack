import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from './api/auth/[...nextauth]/route'
import routes from '@/routes'

export default async function NotFound() {
  const session = await getServerSession(authOptions)

  if (session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      </div>
    )
  } else {
    redirect(routes.login)
  }
}
