import { checkSession } from '@/utils/checkSession'
import RegisterForm from '@/components/admin/register'
import RulesComponent from '@/components/admin/roules'
import ComponentsAccess from '@/components/admin/componentAcess'
import { checkUserPermission } from '@/pages/api/userPermission'

function Settings({ token }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {<RegisterForm token={token} />}
      <RulesComponent token={token} />
      <ComponentsAccess token={token} />
    </div>
  )
}

export default Settings

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
    componentNames: ['AdminPanel'],
  })

  if (!componentPermission.AdminPanel) {
    return {
      notFound: true,
    }
  }

  return {
    props: { token },
  }
}
