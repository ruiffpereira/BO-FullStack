// components/Sidebar.js
import { useState } from 'react'
import Link from 'next/link'
import { FaBars, FaTimes } from 'react-icons/fa'
import { signOut } from 'next-auth/react'

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = '/admin/login'
  }

  return (
    <div className="flex">
      <div
        className={`fixed inset-y-0 left-0 bg-gray-800 text-white w-64 p-4 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
      >
        <button className="md:hidden mb-4" onClick={toggleSidebar}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
        <nav>
          <ul>
            <li className="mb-2">
              <Link
                href="/dashboard"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Home
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/ecommerce"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Ecommerce
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/schedule"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Schedule
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/customers"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Customers
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/settings"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Settings
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/admin"
                className="block p-2 hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Admin Panel
              </Link>
            </li>
            <li className="mb-2">
              <button
                className="block p-2 hover:bg-gray-700 w-full text-left"
                onClick={handleLogout}
              >
                Terminar sessao
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <button className="md:hidden p-4 flex" onClick={toggleSidebar}>
        {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </button>
    </div>
  )
}

export default Sidebar
