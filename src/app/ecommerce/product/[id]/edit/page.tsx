import routes from '@/routes'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import ProductPage from '@/components/product/product'
import { getProductsId } from '@/servers/backoffice/hooks/useGetProductsId'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  let product = null

  if (!session) {
    redirect(routes.login)
  }

  if (!id) {
    return <div>Product ID is required</div>
  }
  try {
    product = await getProductsId(id, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })
  } catch (error) {
    console.error(error)
    return <div>Product not found</div>
  }

  if (!product) {
    return <div>Product not found</div>
  }

  return (
    <>
      <ProductPage session={session} productData={product} />
    </>
  )
}
