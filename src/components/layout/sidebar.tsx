'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { GetUserpermissions200 } from '@/servers/backoffice/types/GetUserpermissions'

const linkClass = (active: boolean) =>
  `block w-full rounded-md px-2 py-3 text-left text-sm transition-colors ${active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-gray-700 hover:text-white'}`

const Sidebar = ({
  isOpen,
  toggleSidebar,
  permissions,
}: {
  isOpen: boolean
  toggleSidebar: () => void
  permissions: GetUserpermissions200
}) => {
  const pathname = usePathname()
  const [scheduleOpen, setScheduleOpen] = useState(pathname.startsWith('/schedule'))

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
            <li className="mb-1">
              <Link
                href="/dashboard"
                className={linkClass(pathname === '/dashboard')}
                onClick={toggleSidebar}
              >
                Dashboard
              </Link>
            </li>

            {permissions.map((permission) => {
              if (permission.name === 'VIEW_PRODUCTS') {
                return (
                  <li key={permission.componentId} className="mb-1">
                    <Link
                      href="/ecommerce"
                      className={linkClass(pathname.startsWith('/ecommerce'))}
                      onClick={toggleSidebar}
                    >
                      Ecommerce
                    </Link>
                  </li>
                )
              }

              if (permission.name === 'VIEW_SCHEDULE') {
                return (
                  <li key={permission.componentId} className="mb-1">
                    <button
                      className={`flex w-full items-center justify-between rounded-md px-2 py-3 text-left text-sm transition-colors ${pathname.startsWith('/schedule') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-gray-700 hover:text-white'}`}
                      onClick={() => setScheduleOpen((o) => !o)}
                    >
                      Agenda
                      {scheduleOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    {scheduleOpen && (
                      <ul className="mt-1 space-y-1 pl-3">
                        <li>
                          <Link
                            href="/schedule"
                            className={linkClass(pathname === '/schedule')}
                            onClick={toggleSidebar}
                          >
                            Calendário
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/schedule/services"
                            className={linkClass(pathname === '/schedule/services')}
                            onClick={toggleSidebar}
                          >
                            Serviços
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/schedule/settings"
                            className={linkClass(pathname === '/schedule/settings')}
                            onClick={toggleSidebar}
                          >
                            Configurações
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                )
              }

              if (permission.name === 'VIEW_CUSTOMERS') {
                return (
                  <li key={permission.componentId} className="mb-1">
                    <Link
                      href="/customers"
                      className={linkClass(pathname.startsWith('/customers'))}
                      onClick={toggleSidebar}
                    >
                      Clientes
                    </Link>
                  </li>
                )
              }

              if (permission.name === 'VIEW_ADMIN') {
                return (
                  <li key={permission.componentId} className="mb-1">
                    <Link
                      href="/management"
                      className={linkClass(pathname.startsWith('/management'))}
                      onClick={toggleSidebar}
                    >
                      Admin
                    </Link>
                  </li>
                )
              }

              return null
            })}

            <li className="mt-4 border-t border-slate-700 pt-4">
              <button
                className="block w-full rounded-md px-2 py-3 text-left text-sm text-slate-400 hover:bg-gray-700 hover:text-white"
                onClick={handleLogout}
              >
                Terminar sessão
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

export default Sidebar
