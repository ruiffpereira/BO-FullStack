import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import UsersManager from '@/components/management/users-manager'

export default async function ManagementPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin')

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Gestão de Utilizadores</h1>
      <UsersManager />
    </div>
  )
}
