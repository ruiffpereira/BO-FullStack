import { Fragment } from 'react'

function TopBar() {
  return (
    <Fragment>
      <div
        className="flex-shrink-0 flex gap-4 justify-between p-4 border-b border-gray-200"
        style={{ paddingRight: '60px' }}
      >
        <div>{/* <Input placeholder="Search" /> */}</div>
        <div></div>
      </div>
    </Fragment>
  )
}

export default TopBar
