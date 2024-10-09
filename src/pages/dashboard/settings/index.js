import { checkSession } from '@/utils/checkSession'
import Profile from '@/components/admin/profile'
import { getSession } from 'next-auth/react'

function Settings({ token }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {<Profile token={token} />}
    </div>
  )
}

export default Settings

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)
  if (sessionCheckResult) {
    return sessionCheckResult
  }

  const token = await getSession(context)

  if (!token) {
    return {
      notFound: true, // Next.js retornará uma página 404
    }
  }

  return {
    props: { token },
  }
}
