// Import necessary dependencies

import '@/styles/globals.css'
import { SessionProvider, getSession } from 'next-auth/react' // Adjust the import path according to your session management library
import { useRouter } from 'next/router'
import Layout from '@/components/layout/layout'

export default function MyApp({ Component, pageProps }) {
  const router = useRouter()
  const isLoginPage = router.pathname === '/admin/login'

  return (
    <SessionProvider session={pageProps.session}>
      {isLoginPage ? (
        <Component {...pageProps} />
      ) : (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      )}
    </SessionProvider>
  )
}

MyApp.getInitialProps = async ({ ctx }) => {
  // Fetch global data here
  const session = await getSession(ctx)

  return {
    pageProps: {
      session,
    },
  }
}
