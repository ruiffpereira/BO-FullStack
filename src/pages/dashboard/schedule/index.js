import { checkSession } from '@/utils/checkSession'
import { checkUserPermission } from '@/pages/api/userPermission'

function Schedule() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      Marcacoes
    </div>
  )
}

export default Schedule

export async function getServerSideProps(context) {
  const sessionCheckResult = await checkSession(context.req)

  if (sessionCheckResult.redirect) {
    return sessionCheckResult
  }

  const { token } = sessionCheckResult.props

  if (!token) {
    return {
      notFound: true, // Next.js retornará uma página 404
    }
  }

  const componentPermission = await checkUserPermission(token, {
    componentNames: ['Schedule'],
  })

  if (!componentPermission.Schedule) {
    return {
      notFound: true,
    }
  }

  return {
    props: { token },
  }
}
