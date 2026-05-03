import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/authOptions'
import ServicesManager from '@/components/schedule/services-manager'

export default async function ScheduleServicesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin')

  return (
    <div className="p-4 md:p-6">
      <ServicesManager />
    </div>
  )
}
