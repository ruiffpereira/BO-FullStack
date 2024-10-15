// components/Sidebar.js
import Link from 'next/link'
import { signOut } from 'next-auth/react'

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = '/admin/login'
  }

  return (
    <div className="flex fixed inset-y-0 mt-12 left-0" style={{ zIndex: 1 }}>
      <div
        className={`fixed inset-y-0 left-0 bg-slate-900 text-white w-64 p-4 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
      >
        <nav>
          <ul>
            <li className="mb-2">
              <Link
                href="/dashboard"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Home
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/ecommerce"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Ecommerce
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/schedule"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Schedule
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/customers"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Customers
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/settings"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Settings
              </Link>
            </li>
            <li className="mb-2">
              <Link
                href="/dashboard/admin"
                className="block p-2 hover:bg-gray-700"
                onClick={toggleSidebar}
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
    </div>
  )
}

export default Sidebar
