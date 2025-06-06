import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import CategoriesForm from '@/components/categories/categories'

export default async function CategoriesPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect(routes.login)
  }

  return (
    <>
      <CategoriesForm session={session} />
    </>
  )
}
