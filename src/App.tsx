import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Shell } from './components/Shell'
import { Login } from './components/Login'
import { SetupPassword } from './pages/SetupPassword'
import { Dashboard } from './pages/Dashboard'
import { Clientes } from './pages/Clientes'
import { Loja } from './pages/Loja'
import { Agenda } from './pages/Agenda'
import { Admin } from './pages/Admin'
import { Conteudos } from './pages/Conteudos'
import { Tokens } from './pages/Tokens'

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('bo-theme') as 'light' | 'dark') || 'dark',
  )
  const { accessToken } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.style.setProperty('--accent-hex', theme === 'dark' ? '#4C86F0' : '#2A6FDB')
    root.style.setProperty('--accent', theme === 'dark' ? '76 134 240' : '42 111 219')
    localStorage.setItem('bo-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // Public routes — accessible without authentication
  if (location.pathname === '/setup-password') {
    return <SetupPassword theme={theme} onToggleTheme={toggleTheme} />
  }

  if (!accessToken) {
    return <Login theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <Shell theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/conteudos" element={<Conteudos />} />
        <Route path="/tokens" element={<Tokens />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  )
}

export default App
