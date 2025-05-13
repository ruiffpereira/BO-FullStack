// components/Sidebar.js
'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { GetUserpermissions200 } from '@/server/backoffice'
import { permission } from 'process'

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
    <div className="flex fixed inset-y-0 left-0" style={{ zIndex: 1 }}>
      <div
        className={`fixed mt-12 inset-y-0 left-0 bg-slate-900 text-white w-52 p-4 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
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
            {permissions.map((permission) => {
              if (permission.name === 'VIEW_PRODUCTS') {
                return (
                  <li key={permission.componentId} className="mb-2">
                    <Link
                      href="/ecommerce"
                      className="block p-2 hover:bg-gray-700"
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
                      className="block p-2 hover:bg-gray-700"
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
                      className="block p-2 hover:bg-gray-700"
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
                      className="block p-2 hover:bg-gray-700"
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
