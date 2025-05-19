// components/Sidebar.js
'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { GetUserpermissions200 } from '@/server/backoffice/types/GetUserpermissions'

const Sidebar = ({
  isOpen,
  toggleSidebar,
  permissions,
}: {
  isOpen: boolean
  toggleSidebar: () => void
  permissions: GetUserpermissions200
}) => {
  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = '/admin'
  }

  return (
    <div className="fixed inset-y-0 left-0 flex" style={{ zIndex: 1 }}>
      <div
        className={`fixed inset-y-0 left-0 mt-12 w-52 transform bg-slate-900 p-4 text-white ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
      >
        <nav>
          <ul>
            <li key={'dasboardkey'} className="mb-2">
              <Link
                href="/dashboard"
                className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
                onClick={toggleSidebar}
              >
                Dashboard
              </Link>
            </li>
            {permissions.map((permission) => {
              if (permission.name === 'VIEW_PRODUCTS') {
                return (
                  <li key={permission.componentId} className="mb-2">
                    <Link
                      href="/ecommerce"
                      className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
                      onClick={toggleSidebar}
                    >
                      Ecommerce
                    </Link>
                  </li>
                )
              }
              if (permission.name === 'VIEW_SCHEDULE') {
                return (
                  <li key={permission.componentId} className="mb-2">
                    <Link
                      href="/schedule"
                      className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
                      onClick={toggleSidebar}
                    >
                      Schedule
                    </Link>
                  </li>
                )
              }
              if (permission.name === 'VIEW_CUSTOMERS') {
                return (
                  <li key={permission.componentId} className="mb-2">
                    <Link
                      href="/customers"
                      className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
                      onClick={toggleSidebar}
                    >
                      Customers
                    </Link>
                  </li>
                )
              }
              if (permission.name === 'VIEW_ADMIN') {
                return (
                  <li key={permission.componentId} className="mb-2">
                    <Link
                      href="/admin"
                      className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
                      onClick={toggleSidebar}
                    >
                      Schedule
                    </Link>
                  </li>
                )
              }
            })}
            <li className="mb-2">
              <button
                className="block w-full rounded-md px-2 py-4 text-left hover:bg-gray-700"
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
