import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Custom404() {
  const router = useRouter()

  useEffect(() => {
    // Redireciona para o dashboard após 1 segundo
    router.replace('/dashboard')
  }, [router])

  return (
    <div>
      <div>Page Not Found. Redirecting to Dashboard...</div>
    </div>
  )
}
