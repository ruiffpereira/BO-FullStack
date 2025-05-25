'use client'
import { Fragment } from 'react'

function TopBar() {
  return (
    <Fragment>
      <div
        className="flex flex-shrink-0 justify-between gap-4 border-b border-gray-200 p-4"
        style={{ paddingRight: '60px' }}
      >
        <div>{/* <Input placeholder="Search" /> */}</div>
      </div>
    </Fragment>
  )
}

export default TopBar
