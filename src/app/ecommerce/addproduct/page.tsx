import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import ProductPage from '@/components/product/product'
import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function AddProduct() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(routes.login)
  }

  return (
    <>
      <ProductPage session={session} />
    </>
  )
}
