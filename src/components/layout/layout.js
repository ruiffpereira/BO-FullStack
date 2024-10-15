import Sidebar from './sidebar'
import { useState } from 'react'
import { FaBars, FaTimes } from 'react-icons/fa'

function Layout(props) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="shrink-0 h-12 px-4 gap-4 flex items-center border-b border-b-gray-100-100 sticky z-10 inset-0 bg-white shadow">
        <button className="md:hidden flex" onClick={toggleSidebar}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
        <div className="text-lg font-bold text-blue-900">CODE FULL STACK</div>
      </div>
      <div className="grow flex md:pl-64">
        <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />
        <div
          className="flex-grow p-4 min-w-0 overflow-auto bg-slate-100"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isOpen) {
              setIsOpen(false)
            }
          }}
        >
          {props.children}
        </div>
      </div>
    </div>
  )
}

export default Layout
