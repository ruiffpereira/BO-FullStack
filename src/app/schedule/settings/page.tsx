import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import SettingsManager from '@/components/schedule/settings-manager'

export default async function ScheduleSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin')

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold">Configurações</h1>
      <SettingsManager />
    </div>
  )
}
