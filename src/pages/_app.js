// Import necessary dependencies

import '@/styles/globals.css'
import { SessionProvider } from 'next-auth/react' // Adjust the import path according to your session management library
import { useRouter } from 'next/router'
import Layout from '@/components/layout/layout'

export default function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}) {
  const router = useRouter()

  if (router.pathname === '/admin/login') {
    return (
      <SessionProvider session={session}>
        <Component {...pageProps} />
      </SessionProvider>
    )
  }

  return (
    <SessionProvider session={session}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  )
}
