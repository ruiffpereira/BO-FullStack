'use client'

import { GetUserpermissions200 } from '@/server/backoffice/types/GetUserpermissions'
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
      <div className="sticky inset-0 z-10 flex h-12 shrink-0 items-center gap-4 bg-white px-4 shadow">
        <button className="flex md:hidden" onClick={toggleSidebar}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
        <div className="text-lg font-bold text-slate-900">CODE FULL STACK</div>
      </div>
      <div className="flex grow overflow-hidden md:pl-52">
        <Sidebar
          isOpen={isOpen}
          toggleSidebar={toggleSidebar}
          permissions={permissions}
        />
        <div
          className={` ${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-0 md:hidden`}
          onClick={handleInvisibleUnderlayClick}
        ></div>
        <div className="min-w-0 flex-grow overflow-auto bg-slate-100 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout
