import type { Metadata } from 'next'
import './globals.css'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import Providers from '@/lib/provider'
import Layout from '@/components/layout/layout'
import { getUserpermissions } from '@/server/backoffice/hooks/useGetUserpermissions'
import { GetUserpermissions200 } from '@/server/backoffice'
import AuthProvider from '@/context/AuthProvider'

export const metadata: Metadata = {
  title: 'Code Full Stack',
  description: 'A Full Stack Code Challenge',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return (
      <html lang="en">
        <body className="h-dvh bg-gray-100">
          <AuthProvider>{children}</AuthProvider>
        </body>
      </html>
    )
  }

  if (session && session.accessToken) {
    try {
      const permissions: GetUserpermissions200 = await getUserpermissions({
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      return (
        <html lang="en">
          <body className="h-dvh bg-gray-100">
            <AuthProvider>
              <Providers>
                <Layout permissions={permissions}>{children}</Layout>
              </Providers>
            </AuthProvider>
          </body>
        </html>
      )
    } catch (error) {
      //console.error('Erro ao buscar permissões:', error)
      return (
        <html lang="en">
          <body className="h-dvh bg-gray-100">
            <div className="grid h-full place-items-center text-2xl font-bold">
              Erro No Servidor
            </div>
          </body>
        </html>
      )
    }
  }
}
