'use client'

import { GetUserpermissions200 } from '@/server/backoffice'
import Sidebar from './sidebar'
import { useState } from 'react'
import { FaBars, FaTimes } from 'react-icons/fa'

function Layout({
  children,
  permissions,
}: Readonly<{
  children: React.ReactNode
  permissions: GetUserpermissions200
}>) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  function handleInvisibleUnderlayClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isOpen) {
      setIsOpen(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="shrink-0 h-12 px-4 gap-4 flex items-center sticky z-10 inset-0 bg-white shadow">
        <button className="md:hidden flex" onClick={toggleSidebar}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
        <div className="text-lg font-bold text-slate-900">CODE FULL STACK</div>
      </div>
      <div className="grow flex md:pl-52 overflow-hidden">
        <Sidebar
          isOpen={isOpen}
          toggleSidebar={toggleSidebar}
          permissions={permissions}
        />
        <div
          className={` ${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-0 md:hidden `}
          onClick={handleInvisibleUnderlayClick}
        ></div>
        <div className="flex-grow p-4 min-w-0 overflow-auto bg-slate-100">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout
