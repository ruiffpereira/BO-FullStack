import { useState } from 'react'

export default function Custom404() {
  const [showMessage] = useState(true) // State to control the display of the message

  return (
    <div>
      {showMessage && <div>Page Not Found. Redirecting to Dashboard...</div>}
    </div>
  )
}
