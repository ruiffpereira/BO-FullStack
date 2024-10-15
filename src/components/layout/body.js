import { Fragment } from 'react'

function Body(props) {
  return (
    <Fragment>
      <div className="font-sans ">{props.children}</div>
    </Fragment>
  )
}

export default Body
