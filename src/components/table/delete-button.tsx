import { FaTrash } from 'react-icons/fa'

export default function DeleteButton({ onclick }: { onclick: () => void }) {
  return (
    <button onClick={onclick} className="hover:underline">
      <FaTrash />
    </button>
  )
}
