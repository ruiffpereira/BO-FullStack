import Sidebar from './sidebar'

function Layout(props) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-grow pt-16 md:p-4 p-4 min-w-0 overflow-auto">
        {props.children}
      </div>
    </div>
  )
}

export default Layout
