// Import necessary dependencies

import '@/styles/globals.css'
import { SessionProvider, getSession } from 'next-auth/react' // Adjust the import path according to your session management library
import Layout from '@/components/layout/layout'
import { checkUserPermission } from '@/pages/api/userPermission'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function MyApp({ Component, pageProps }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SessionProvider session={pageProps.session}>
      <QueryClientProvider client={queryClient}>
        {!pageProps.session ? (
          <Component {...pageProps} />
        ) : (
          <Layout componentsPermissions={pageProps.componentsPermissions}>
            <Component {...pageProps} />
          </Layout>
        )}
      </QueryClientProvider>
    </SessionProvider>
  )
}

MyApp.getInitialProps = async ({ ctx }) => {
  // Fetch global data here
  const session = await getSession(ctx)

  if (!session) {
    return {
      pageProps: { session },
    }
  }

  const componentsPermissions = await checkUserPermission(session.accessToken, {
    componentNames: [
      'VIEW_ORDERS',
      'VIEW_SCHEDULE',
      'VIEW_PRODUCTS',
      'VIEW_CUSTOMERS',
      'VIEW_ADMIN',
    ],
  })

  return {
    pageProps: {
      session,
      componentsPermissions,
    },
  }
}