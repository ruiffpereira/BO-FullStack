import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Custom404() {
  const router = useRouter()
  const [showMessage] = useState(true) // State to control the display of the message

  useEffect(() => {
    // Set a timeout to redirect after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/dashboard') // Use replace to avoid adding the current page to the history stack
    }, 1000) // 3000 milliseconds = 3 seconds

    // Cleanup function to clear the timeout if the component unmounts
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div>
      {showMessage && <div>Page Not Found. Redirecting to Dashboard...</div>}
    </div>
  )
}
