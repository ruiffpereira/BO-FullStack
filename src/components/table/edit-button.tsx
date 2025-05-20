'use client'

import { FaPen } from 'react-icons/fa'

export default function EditButton({ teste }: { teste?: () => void }) {
  return (
    <button onClick={teste} className="hover:underline">
      <FaPen />
    </button>
  )
}
