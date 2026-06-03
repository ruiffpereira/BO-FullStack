import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { Shell } from './components/Shell'
import { Login } from './components/Login'
import { Dashboard } from './pages/Dashboard'
import { Clientes } from './pages/Clientes'
import { Loja } from './pages/Loja'
import { Agenda } from './pages/Agenda'
import { Admin } from './pages/Admin'

const PERM_TO_ROUTE: Record<string, string> = {
  VIEW_CUSTOMERS: 'clientes',
  VIEW_PRODUCTS:  'loja',
  VIEW_SCHEDULE:  'agenda',
  VIEW_ADMIN:     'admin',
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('bo-theme') as 'light' | 'dark') || 'light',
  )
  const { accessToken, permissions } = useAuth()
  const [route, setRoute] = useState('dashboard')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.style.setProperty('--accent-hex', theme === 'dark' ? '#4C86F0' : '#2A6FDB')
    root.style.setProperty('--accent', theme === 'dark' ? '76 134 240' : '42 111 219')
    localStorage.setItem('bo-theme', theme)
  }, [theme])

  const accessibleRoutes = [
    'dashboard',
    ...permissions
      .map((p) => PERM_TO_ROUTE[p.name ?? ''])
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i),
  ]

  useEffect(() => {
    if (accessToken && !accessibleRoutes.includes(route)) {
      setRoute(accessibleRoutes[0] ?? 'dashboard')
    }
  }, [accessToken, permissions]) // eslint-disable-line

  if (!accessToken) {
    return (
      <Login
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
    )
  }

  return (
    <Shell
      route={route}
      setRoute={setRoute}
      accessibleRoutes={accessibleRoutes}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {route === 'dashboard' && <Dashboard />}
      {route === 'clientes' && <Clientes />}
      {route === 'loja' && <Loja />}
      {route === 'agenda' && <Agenda />}
      {route === 'admin' && <Admin />}
    </Shell>
  )
}

export default App
