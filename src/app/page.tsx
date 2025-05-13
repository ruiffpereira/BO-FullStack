import routes from '@/routes'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect(routes.dashboard)
  else redirect(routes.login)
}
