import { Fragment } from 'react'

function Body({ children }) {
  return (
    <Fragment>
      <div className="font-sans ">{children}</div>
    </Fragment>
  )
}

export default Body
