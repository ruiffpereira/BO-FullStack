'use client'

import { useSession } from 'next-auth/react'
import routes from '@/routes'
import { redirect } from 'next/navigation'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { use } from 'react'

export default function ProductPageOrder({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session, status } = useSession()
  const { id } = use(params)

  if (status === 'loading') {
    return (
      <div>
        <AiOutlineLoading3Quarters />
      </div>
    )
  }

  if (!session) {
    redirect(routes.login)
  }
  return (
    <div className="grid h-full place-items-center text-2xl font-bold">
      Encomendas do produto {id}
    </div>
  )
}
