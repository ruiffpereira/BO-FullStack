import Sidebar from './sidebar'

function Layout(props) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-grow p-4 min-w-0">{props.children}</div>
    </div>
  )
}

export default Layout
